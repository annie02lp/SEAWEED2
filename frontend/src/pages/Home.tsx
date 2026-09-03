import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, ChevronDown, Heart, Leaf, LockKeyhole, Volume2, VolumeX, Waves } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { apiGet, apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { ImpactStats, ScoreRecord, ScoreSubmit } from "@/lib/types";

type Stage = "ready" | "playing" | "over";
type ItemKind = "bottle" | "can" | "ring" | "seaweed";

interface FallingItem {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  speed: number;
  size: number;
}

const ITEM_META: Record<ItemKind, { label: string; points: number }> = {
  bottle: { label: "Botella", points: 10 },
  can: { label: "Lata", points: 12 },
  ring: { label: "Anillo", points: 15 },
  seaweed: { label: "Sargazo", points: 20 },
};

const ITEM_KINDS: ItemKind[] = ["bottle", "bottle", "can", "ring", "seaweed"];

const ECO_FACTS = [
  "El sargazo puede ser refugio para pequeños animales marinos, pero en exceso al descomponerse consume oxígeno cerca de la costa.",
  "Una botella de plástico puede tardar cientos de años en degradarse; recogerla antes de que llegue al mar evita que se fragmente en microplásticos.",
  "Las tortuguitas siguen la luz del horizonte para encontrar el mar. Una playa limpia y sin luces intensas les da una oportunidad más segura.",
  "Los anillos plásticos pueden atrapar aves y animales marinos. Retirarlos y cortarlos antes de desecharlos reduce ese riesgo.",
];

const EMPTY_IMPACT: ImpactStats = { total_games: 0, total_cleanup_points: 0, leaderboard: [] };

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-ES").format(value);
}

function FallingSprite({ item }: { item: FallingItem }) {
  return (
    <div
      aria-label={`${ITEM_META[item.kind].label}, ${ITEM_META[item.kind].points} puntos`}
      className={`falling-item falling-${item.kind}`}
      data-testid={`falling-item-${item.id}`}
      style={{ left: `${item.x * 100}%`, top: `${item.y}px` }}
    >
      {item.kind === "bottle" && <span className="bottle-cap" data-testid={`bottle-cap-${item.id}`} />}
      {item.kind === "can" && <span className="can-tab" data-testid={`can-tab-${item.id}`} />}
      {item.kind === "ring" && <span className="ring-hole" data-testid={`ring-hole-${item.id}`} />}
      {item.kind === "seaweed" && (
        <span className="seaweed-leaves" data-testid={`seaweed-leaves-${item.id}`}>
          <i /> <i /> <i />
        </span>
      )}
      <span className="item-points" data-testid={`item-points-${item.id}`}>+{ITEM_META[item.kind].points}</span>
    </div>
  );
}

function HeartMeter({ lives }: { lives: number }) {
  return (
    <div className="heart-meter" data-testid="lives-indicator" aria-label={`${lives} vidas restantes`}>
      {Array.from({ length: 7 }, (_, index) => (
        <Heart
          aria-hidden="true"
          className={`pixel-heart ${index < lives ? "heart-full" : "heart-empty"}`}
          data-testid={`life-heart-${index + 1}`}
          fill="currentColor"
          key={index}
          size={22}
          strokeWidth={3}
        />
      ))}
    </div>
  );
}

function TurtleScene() {
  return (
    <>
      <div className="sun-disc" data-testid="sun-disc" />
      <div className="cloud cloud-one" data-testid="cloud-one" />
      <div className="cloud cloud-two" data-testid="cloud-two" />
      <div className="nest-marker nest-left" data-testid="nest-marker-left"><span>NIDO</span></div>
      <div className="nest-marker nest-right" data-testid="nest-marker-right"><span>NIDO</span></div>
      <div className="turtle turtle-one" data-testid="turtle-one"><span /></div>
      <div className="turtle turtle-two" data-testid="turtle-two"><span /></div>
      <div className="shoreline" data-testid="shoreline" />
    </>
  );
}

function WoodenPanel({ children, className = "", testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <section className={`wood-panel ${className}`} data-testid={testId}>{children}</section>;
}

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [stage, setStage] = useState<Stage>("ready");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(7);
  const [collected, setCollected] = useState(0);
  const [playerX, setPlayerX] = useState(0.5);
  const [items, setItems] = useState<FallingItem[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const [ecoFact, setEcoFact] = useState(ECO_FACTS[0]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const worldRef = useRef<HTMLDivElement>(null);
  const playerXRef = useRef(0.5);
  const itemsRef = useRef<FallingItem[]>([]);
  const livesRef = useRef(7);
  const scoreRef = useRef(0);
  const collectedRef = useRef(0);
  const nicknameRef = useRef("");
  const itemIdRef = useRef(0);
  const lastFrameRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const saveScoreMutationRef = useRef<((payload: ScoreSubmit) => void) | null>(null);

  const impactQuery = useQuery({
    queryKey: ["impact"],
    queryFn: () => apiGet<ImpactStats>("/scores/impact"),
    retry: false,
  });
  const saveScore = useMutation({
    mutationFn: (payload: ScoreSubmit) => apiPost<ScoreRecord>("/scores", payload),
    onSuccess: async () => {
      setSaveState("saved");
      await queryClient.invalidateQueries({ queryKey: ["impact"] });
    },
    onError: () => {
      setSaveState("error");
      toast.error("No pudimos guardar la partida. Inténtalo de nuevo.");
    },
  });
  saveScoreMutationRef.current = saveScore.mutate;

  const playSound = useCallback((type: "catch" | "sargassum" | "lose" | "over" | "click") => {
    if (!soundOn) return;
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    void context.resume();
    const now = context.currentTime;
    const notes = type === "over" ? [220, 180, 140] : type === "lose" ? [130, 90] : type === "sargassum" ? [180, 240] : type === "click" ? [340] : [520, 760];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type === "sargassum" ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.08);
      gain.gain.setValueAtTime(0.0001, now + index * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.08, now + index * 0.08 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.13);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + index * 0.08);
      oscillator.stop(now + index * 0.08 + 0.15);
    });
  }, [soundOn]);

  const finishGame = useCallback(() => {
    setStage("over");
    setEcoFact(ECO_FACTS[Math.floor(Math.random() * ECO_FACTS.length)]);
    setSaveState("saving");
    playSound("over");
    saveScoreMutationRef.current?.({ nickname: nicknameRef.current, score: scoreRef.current, collected_count: collectedRef.current });
  }, [playSound]);

  const movePlayer = useCallback((direction: -1 | 1) => {
    const next = Math.max(0.08, Math.min(0.92, playerXRef.current + direction * 0.08));
    playerXRef.current = next;
    setPlayerX(next);
  }, []);

  useEffect(() => {
    if (stage !== "playing") return undefined;

    let animationFrame = 0;
    lastFrameRef.current = performance.now();
    spawnTimerRef.current = 0;

    const tick = (now: number) => {
      const elapsed = Math.min(now - lastFrameRef.current, 48);
      lastFrameRef.current = now;
      const worldHeight = worldRef.current?.clientHeight ?? 520;
      const worldWidth = worldRef.current?.clientWidth ?? 760;
      spawnTimerRef.current += elapsed;
      let nextItems = itemsRef.current.map((item) => ({ ...item, y: item.y + item.speed * (elapsed / 16.67) }));

      if (spawnTimerRef.current > 850) {
        spawnTimerRef.current = 0;
        const kind = ITEM_KINDS[Math.floor(Math.random() * ITEM_KINDS.length)];
        const nextItem: FallingItem = {
          id: itemIdRef.current++,
          kind,
          x: 0.08 + Math.random() * 0.84,
          y: -42,
          speed: 2.25 + Math.min(scoreRef.current * 0.006, 1.35),
          size: kind === "seaweed" ? 48 : 38,
        };
        nextItems = [...nextItems, nextItem];
      }

      let nextLives = livesRef.current;
      let nextScore = scoreRef.current;
      let nextCollected = collectedRef.current;
      const survivingItems: FallingItem[] = [];
      nextItems.forEach((item) => {
        const inCatchZone = item.y > worldHeight - 142 && item.y < worldHeight - 62;
        const closeToBoat = Math.abs(item.x * worldWidth - playerXRef.current * worldWidth) < 88;
        if (inCatchZone && closeToBoat) {
          nextScore += ITEM_META[item.kind].points;
          nextCollected += 1;
          playSound(item.kind === "seaweed" ? "sargassum" : "catch");
          return;
        }
        if (item.y > worldHeight - 32) {
          nextLives -= 1;
          playSound("lose");
          return;
        }
        survivingItems.push(item);
      });

      itemsRef.current = survivingItems;
      livesRef.current = nextLives;
      scoreRef.current = nextScore;
      collectedRef.current = nextCollected;
      setItems(survivingItems);
      setLives(nextLives);
      setScore(nextScore);
      setCollected(nextCollected);

      if (nextLives <= 0) {
        finishGame();
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [finishGame, playSound, stage]);

  useEffect(() => {
    if (stage !== "playing") return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") movePlayer(-1);
      if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") movePlayer(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [movePlayer, stage]);

  const impact = impactQuery.data ?? EMPTY_IMPACT;
  const bestScore = useMemo(() => impact.leaderboard[0]?.score ?? 0, [impact.leaderboard]);

  const startGame = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = nickname.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2) {
      toast.error("Escribe un apodo de al menos 2 caracteres.");
      return;
    }
    nicknameRef.current = cleanName;
    setNickname(cleanName);
    setStage("playing");
    setScore(0);
    setLives(7);
    setCollected(0);
    setItems([]);
    setSaveState("idle");
    scoreRef.current = 0;
    livesRef.current = 7;
    collectedRef.current = 0;
    itemsRef.current = [];
    playerXRef.current = 0.5;
    setPlayerX(0.5);
    playSound("click");
  };

  const restartGame = () => {
    setStage("ready");
    setItems([]);
    setSaveState("idle");
    playSound("click");
  };

  return (
    <main className="seaweed-app" data-testid="seaweed-app">
      <Toaster position="top-right" richColors />
      <header className="topbar" data-testid="topbar">
        <div className="brand-lockup" data-testid="brand-lockup">
          <div className="brand-mark" data-testid="brand-mark"><Waves size={26} strokeWidth={3} /></div>
          <div>
            <p className="brand-title" data-testid="brand-title">SEAWEED</p>
            <p className="brand-subtitle" data-testid="brand-subtitle">Misión: playa limpia</p>
          </div>
        </div>
        <div className="topbar-note" data-testid="topbar-note"><Leaf size={15} /> Protege el camino al mar</div>
        <button
          aria-label={soundOn ? "Silenciar sonidos" : "Activar sonidos"}
          className="sound-toggle"
          data-testid="sound-toggle-btn"
          onClick={() => { setSoundOn((current) => !current); playSound("click"); }}
          type="button"
        >
          {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span>{soundOn ? "SONIDO ON" : "SONIDO OFF"}</span>
        </button>
      </header>

      <div className="hero-layout">
        <section className="intro-copy" data-testid="intro-copy">
          <Badge className="mission-badge" data-testid="mission-badge"><span className="badge-dot" /> MISIÓN DE CONSERVACIÓN</Badge>
          <h1 data-testid="page-title">Limpia la costa.<br /><em>Salva el viaje.</em></h1>
          <p className="hero-lede" data-testid="hero-lede">Atrapa la basura y retira el sargazo antes de que las tortuguitas lleguen al agua.</p>
          <div className="hero-stats" data-testid="hero-stats">
            <div data-testid="hero-stat-lives"><strong>7</strong><span>vidas por partida</span></div>
            <div data-testid="hero-stat-items"><strong>∞</strong><span>playas por proteger</span></div>
          </div>
          <div className="privacy-note" data-testid="privacy-note"><LockKeyhole size={14} /> Sin registro · Solo guardamos tu apodo y puntuación</div>
        </section>

        <WoodenPanel className="start-panel">
          <div className="panel-nail nail-left" data-testid="panel-nail-left" /><div className="panel-nail nail-right" data-testid="panel-nail-right" />
          {stage === "ready" ? (
            <>
              <div className="panel-kicker" data-testid="start-panel-kicker">PUESTO DE CONTROL // 01</div>
              <h2 data-testid="start-panel-title">¿Quién está<br /><span>al timón?</span></h2>
              <p className="panel-copy" data-testid="start-panel-copy">Escribe un apodo para marcar tu rescate en el registro comunitario.</p>
              <form className="nickname-form" data-testid="nickname-form" onSubmit={startGame}>
                <label data-testid="nickname-label" htmlFor="nickname">TU APODO</label>
                <Input
                  autoComplete="off"
                  data-testid="nickname-input"
                  id="nickname"
                  maxLength={12}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ej. OLA VERDE"
                  value={nickname}
                />
                <Button className="start-button" data-testid="start-game-button" type="submit">
                  BOTAR EL BOTE <ArrowRight size={17} strokeWidth={3} />
                </Button>
              </form>
              <div className="best-score" data-testid="best-score"><span>MEJOR RESCATE COMUNITARIO</span><strong>{bestScore ? formatNumber(bestScore) : "—"}</strong></div>
            </>
          ) : (
            <div className="mission-brief" data-testid="mission-brief">
              <div className="panel-kicker" data-testid="mission-brief-kicker">MANUAL DE CAMPO // 02</div>
              <h2 data-testid="mission-brief-title">Atrapa.<br /><span>Protege.</span></h2>
              <div className="instruction-list" data-testid="instruction-list">
                <div data-testid="instruction-move"><kbd>A</kbd><kbd>D</kbd><span>Mueve el bote</span></div>
                <div data-testid="instruction-catch"><span className="mini-bottle" /> <span className="mini-can" /> <span>+ puntos por cada hallazgo</span></div>
                <div data-testid="instruction-miss"><Heart size={18} fill="#FF4D4D" /> <span>Fallar cuesta una vida</span></div>
              </div>
              <div className="current-player" data-testid="current-player"><span>JUGANDO COMO</span><strong>{nickname || "RESCATISTA"}</strong></div>
            </div>
          )}
        </WoodenPanel>
      </div>

      <section className={`game-section ${stage === "playing" ? "is-live" : ""}`} data-testid="game-section">
        <div className="section-heading" data-testid="game-section-heading">
          <div><p className="eyebrow" data-testid="game-eyebrow">ZONA DE ANIDACIÓN // SECTOR 07</p><h2 data-testid="game-title">Marea de rescate</h2></div>
          <p className="section-tip" data-testid="game-section-tip"><span className="live-dot" /> La limpieza empieza contigo</p>
        </div>
        <div className="game-frame" data-testid="game-frame">
          <div className="game-hud" data-testid="game-hud">
            <div className="hud-block" data-testid="hud-lives"><span className="hud-label" data-testid="hud-lives-label">VIDAS</span><HeartMeter lives={lives} /></div>
            <div className="hud-divider" data-testid="hud-divider" />
            <div className="hud-block score-block" data-testid="hud-score"><span className="hud-label" data-testid="hud-score-label">RESCATE</span><strong data-testid="score-display">{formatNumber(score).padStart(4, "0")}</strong><span className="score-unit" data-testid="score-unit">PUNTOS</span></div>
            <div className="hud-divider hud-divider-right" data-testid="hud-divider-right" />
            <div className="hud-block collected-block" data-testid="hud-collected"><span className="hud-label" data-testid="hud-collected-label">HALLAZGOS</span><strong data-testid="collected-display">{collected}</strong></div>
          </div>
          <div className="game-world" data-testid="game-canvas" ref={worldRef} role="application" aria-label="Zona de juego Seaweed">
            <TurtleScene />
            {items.map((item) => <FallingSprite item={item} key={item.id} />)}
            <div className="player-boat" data-testid="player-boat" style={{ left: `${playerX * 100}%` }}><span className="boat-rim" /><span className="boat-net" /><span className="boat-flag">S</span></div>
            {stage === "ready" && <div className="game-overlay preview-overlay" data-testid="game-preview-overlay"><Waves size={34} /><strong data-testid="preview-title">TU PLAYA TE NECESITA</strong><span data-testid="preview-copy">Escribe tu apodo arriba para comenzar</span></div>}
            {stage === "over" && <div className="game-overlay game-over-overlay" data-testid="game-over-modal"><div className="game-over-card"><Badge data-testid="game-over-badge">MISIÓN COMPLETADA</Badge><h2 data-testid="game-over-title">Marea baja,<br /><span>impacto alto.</span></h2><p data-testid="game-over-score-copy">{nickname}, limpiaste <strong>{formatNumber(score)} puntos</strong> de costa.</p><div className="eco-fact" data-testid="eco-fact-card"><Leaf size={19} /><div><span>TIP ECOLÓGICO</span><p>{ecoFact}</p></div></div><div className="save-status" data-testid="save-status">{saveState === "saving" ? "Guardando tu rescate..." : saveState === "saved" ? "✓ Rescate guardado en el impacto global" : saveState === "error" ? "No se pudo guardar; puedes reintentar" : ""}</div><Button className="restart-button" data-testid="restart-game-button" onClick={restartGame} type="button">VOLVER A JUGAR <ChevronDown size={16} /></Button></div></div>}
          </div>
          <div className="touch-controls" data-testid="touch-controls"><Button aria-label="Mover bote a la izquierda" className="touch-button" data-testid="mobile-left-btn" onClick={() => movePlayer(-1)} type="button"><ArrowLeft size={22} /></Button><span data-testid="touch-control-label">CONTROLES</span><Button aria-label="Mover bote a la derecha" className="touch-button" data-testid="mobile-right-btn" onClick={() => movePlayer(1)} type="button"><ArrowRight size={22} /></Button></div>
        </div>
      </section>

      <section className="impact-section" data-testid="impact-section">
        <div className="impact-heading"><div><p className="eyebrow" data-testid="impact-eyebrow">REGISTRO DE LA MAREA // COMUNIDAD</p><h2 data-testid="impact-title">Impacto Global de la Comunidad</h2></div><div className="impact-leaf" data-testid="impact-leaf"><Leaf size={25} /></div></div>
        <div className="impact-grid" data-testid="impact-grid">
          <WoodenPanel className="impact-stat" testId="impact-games-card"><span className="stat-index" data-testid="impact-games-index">01</span><span className="impact-stat-label" data-testid="impact-games-label">PARTIDAS TOTALES JUGADAS</span><strong data-testid="impact-total-games">{formatNumber(impact.total_games)}</strong><span className="stat-foot" data-testid="impact-games-foot">cada partida cuenta</span></WoodenPanel>
          <WoodenPanel className="impact-stat impact-stat-teal" testId="impact-trash-card"><span className="stat-index" data-testid="impact-trash-index">02</span><span className="impact-stat-label" data-testid="impact-trash-label">TOTAL DE BASURA Y SARGAZO RECOLECTADO</span><strong data-testid="impact-total-trash">{formatNumber(impact.total_cleanup_points)}</strong><span className="stat-foot" data-testid="impact-trash-foot">puntos de limpieza</span></WoodenPanel>
          <div className="leaderboard-card" data-testid="leaderboard-card"><div className="leaderboard-header"><div><p className="eyebrow" data-testid="leaderboard-eyebrow">MARCADOR DE MAREA</p><h3 data-testid="leaderboard-title">Top 10 rescates</h3></div><Badge data-testid="leaderboard-badge">SIN FECHAS · PRIVADO</Badge></div><div className="leaderboard-table" data-testid="leaderboard-table"><div className="leader-row leader-head" data-testid="leaderboard-header-row"><span>#</span><span>RESCATISTA</span><span>PUNTOS</span></div>{impact.leaderboard.length === 0 ? <div className="empty-leaderboard" data-testid="leaderboard-empty"><Waves size={18} /><span>Aún no hay partidas. Sé la primera ola.</span></div> : impact.leaderboard.map((record, index) => <div className="leader-row" data-testid={`leaderboard-row-${index + 1}`} key={record.id}><span className="rank-number" data-testid={`leaderboard-rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span><span className="leader-name" data-testid={`leaderboard-name-${index + 1}`}>{record.nickname}</span><strong data-testid={`leaderboard-score-${index + 1}`}>{formatNumber(record.score)}</strong></div>)}</div></div>
        </div>
        <p className="privacy-footer" data-testid="privacy-footer"><LockKeyhole size={14} /> El ranking solo muestra apodo y puntuación. Nunca mostramos fechas ni horas.</p>
      </section>
      <footer className="site-footer" data-testid="site-footer"><span>SEAWEED © 2025</span><span>Hecho para playas vivas <Leaf size={14} /></span></footer>
    </main>
  );
}
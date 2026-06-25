// ====== НАСТРОЙКА ======
// URL твоего Cloudflare Worker. Пусто — данные пишутся в консоль.
const PROXY_URL = "https://proxy-willyougowihme.aviator1112.workers.dev";
// Текст вопроса по умолчанию (можно переопределить через ?q=... в ссылке)
const DEFAULT_ASK = "Пойдёшь гулять со мной?";
// Активности, после которых имеет смысл спросить про еду
const FOOD_ACTS = ["🎬 Кино", "☕ Кофе", "🍿 Netflix & chill"];
// Активности, после которых спрашиваем про напитки
const DRINK_ACTS = ["🍷 Выпьем", "🍿 Netflix & chill"];
// =======================

// ---- персонализация из URL ----
// ?name=Аня — имя в тексте; ?q=Сходим в кино? — свой вопрос
const params = new URLSearchParams(location.search);
function cleanParam(v, max) {
  return String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}
const NAME = cleanParam(params.get("name"), 30);
// текст вопроса: из ?q, иначе дефолт; если есть имя — подставляем «Имя, вопрос»
let ASK_TEXT = cleanParam(params.get("q"), 120) || DEFAULT_ASK;
if (NAME) {
  // первая буква вопроса в нижний регистр после имени
  ASK_TEXT = `${NAME}, ${ASK_TEXT.charAt(0).toLowerCase()}${ASK_TEXT.slice(1)}`;
}

const steps = document.querySelectorAll(".step");
function goto(name) {
  steps.forEach((s) =>
    s.classList.toggle("step--active", s.dataset.step === name),
  );
}

const state = { date: "", time: "", activity: [], food: [], drinks: [], wishes: "" };

/* ---------- звук + фоновая музыка ---------- */
let audioCtx = null;
let soundOn = true; // по умолчанию включено
const soundToggle = document.getElementById("soundToggle");
const bgMusic = document.getElementById("bgMusic");
bgMusic.volume = 0; // нарастим плавно при старте

function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

soundToggle.addEventListener("click", () => {
  soundOn = !soundOn;
  soundToggle.textContent = soundOn ? "🔊" : "🔇";
  if (soundOn) {
    ensureCtx();
    startMusic();
  } else {
    stopMusic();
  }
});

// короткий приятный «дзинь»
function blip(freq = 660, dur = 0.12) {
  if (!soundOn || !audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = "sine";
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.2, audioCtx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}

// фоновая мелодия (mp3, зациклена) — плавное появление громкости
let fadeTimer = null;
function fadeTo(target, ms = 1500) {
  clearInterval(fadeTimer);
  const start = bgMusic.volume;
  const steps = 30;
  let i = 0;
  fadeTimer = setInterval(() => {
    i++;
    bgMusic.volume = Math.min(1, Math.max(0, start + (target - start) * (i / steps)));
    if (i >= steps) {
      clearInterval(fadeTimer);
      if (target === 0) bgMusic.pause();
    }
  }, ms / steps);
}
function startMusic() {
  if (!soundOn) return;
  const p = bgMusic.play();
  if (p && p.catch) p.catch(() => {}); // автоплей может быть заблокирован до жеста
  fadeTo(0.55);
}
function stopMusic() {
  fadeTo(0, 600);
}

/* ---------- конфетти ---------- */
const cvs = document.getElementById("confetti");
const ctx = cvs.getContext("2d");
let confetti = [];
function resizeCanvas() {
  cvs.width = window.innerWidth;
  cvs.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function burstConfetti(count = 120) {
  const colors = ["#e94d58", "#ff8a96", "#ffd1d6", "#ffc857", "#7ed0c9", "#fff"];
  for (let i = 0; i < count; i++) {
    confetti.push({
      x: window.innerWidth / 2,
      y: window.innerHeight / 3,
      vx: (Math.random() - 0.5) * 12,
      vy: Math.random() * -12 - 4,
      g: 0.3 + Math.random() * 0.2,
      size: 6 + Math.random() * 8,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 120 + Math.random() * 60,
    });
  }
  if (!confettiRunning) {
    confettiRunning = true;
    requestAnimationFrame(animateConfetti);
  }
}
let confettiRunning = false;
function animateConfetti() {
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  confetti.forEach((p) => {
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life--;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  });
  confetti = confetti.filter((p) => p.life > 0 && p.y < cvs.height + 40);
  if (confetti.length > 0) {
    requestAnimationFrame(animateConfetti);
  } else {
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    confettiRunning = false;
  }
}

/* ---------- typewriter ---------- */
function typewriter(el, text, speed = 55) {
  el.textContent = "";
  let i = 0;
  (function tick() {
    if (i <= text.length) {
      el.textContent = text.slice(0, i);
      i++;
      setTimeout(tick, speed);
    }
  })();
}

/* ---------- Шаг 0: конверт ---------- */
const envelope = document.getElementById("envelope");
let envelopeOpened = false;
envelope.addEventListener("click", () => {
  if (envelopeOpened) return;
  envelopeOpened = true;
  // первый жест — можно запускать аудио
  ensureCtx();
  if (soundOn) startMusic();
  envelope.classList.add("is-open");
  blip(720);
  setTimeout(() => {
    goto("ask");
    typewriter(document.getElementById("askTypewriter"), ASK_TEXT);
  }, 900);
});

/* ---------- Шаг 1: вопрос ---------- */
const yesBtn = document.getElementById("yesBtn");
const noBtn = document.getElementById("noBtn");

yesBtn.addEventListener("click", () => {
  burstConfetti(140);
  blip(880);
  document.getElementById("yayText").textContent =
    NAME ? `Ура, ${NAME} сказала «да»! 🎉` : `Ура, ты сказала «да»! 🎉`;
  goto("yay");
});

document.getElementById("yayNextBtn").addEventListener("click", () => {
  blip();
  goto("when");
});

// эскалация кнопки "Нет"
const noTexts = [
  "Нет", "точно нет?", "подумай ещё", "ну пожалуйста 🥺",
  "я расстроюсь 😢", "последний шанс…",
];
let noTries = 0;
function escalateNo() {
  noTries++;
  if (noTries < noTexts.length) noBtn.textContent = noTexts[noTries];
  const grow = Math.min(1 + noTries * 0.12, 1.7);
  yesBtn.style.fontSize = 1.15 * grow + "rem";
  yesBtn.style.padding = `0 ${20 * grow}px`;
  const shrink = Math.max(1 - noTries * 0.12, 0.5);
  noBtn.style.fontSize = 1.15 * shrink + "rem";
  if (noTries >= noTexts.length) {
    noBtn.style.opacity = "0";
    noBtn.style.pointerEvents = "none";
    return;
  }
  runAway();
}
function runAway() {
  const pad = 8;
  const maxX = window.innerWidth - noBtn.offsetWidth - pad;
  const maxY = window.innerHeight - noBtn.offsetHeight - pad;
  noBtn.style.position = "fixed";
  noBtn.style.left = Math.max(pad, Math.floor(Math.random() * maxX)) + "px";
  noBtn.style.top = Math.max(pad, Math.floor(Math.random() * maxY)) + "px";
}
noBtn.addEventListener("mouseover", escalateNo);
noBtn.addEventListener("click", escalateNo);
noBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  escalateNo();
});

/* ---------- Шаг 2: дата/время ---------- */
const dateInput = document.getElementById("dateInput");
const timeInput = document.getElementById("timeInput");
const whenHint = document.getElementById("whenHint");
dateInput.min = new Date().toISOString().split("T")[0];

document.getElementById("whenNextBtn").addEventListener("click", () => {
  if (!dateInput.value || !timeInput.value) {
    whenHint.textContent = "Выбери, пожалуйста, дату и время 🙂";
    return;
  }
  whenHint.textContent = "";
  state.date = dateInput.value;
  state.time = timeInput.value;
  blip();
  goto("activity");
});

/* ---------- Шаг 3: активность ---------- */
const actHint = document.getElementById("actHint");
document.querySelectorAll("[data-act]").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("food--selected");
    if (btn.classList.contains("food--selected")) blip(600);
    actHint.textContent = "";
  });
});

// маршрутизация: какие доп. шаги нужны после активности
let route = [];      // очередь шагов: ["food"], ["drinks"], ["food","drinks"] или []
let routeIdx = 0;

document.getElementById("actNextBtn").addEventListener("click", () => {
  const selected = [...document.querySelectorAll("[data-act].food--selected")]
    .map((b) => b.dataset.act);
  if (selected.length === 0) {
    actHint.textContent = "Выбери хотя бы один вариант 🥺";
    return;
  }
  state.activity = selected;
  blip();

  route = [];
  if (selected.some((a) => FOOD_ACTS.includes(a))) route.push("food");
  if (selected.some((a) => DRINK_ACTS.includes(a))) route.push("drinks");
  route.push("wishes"); // пожелания — всегда последний шаг перед финалом
  routeIdx = 0;
  nextRoute();
});

// перейти к следующему шагу маршрута или к финалу
function nextRoute() {
  if (routeIdx < route.length) {
    goto(route[routeIdx]);
    routeIdx++;
  } else {
    finish();
  }
}

/* ---------- Шаг 4: еда ---------- */
const foodHint = document.getElementById("foodHint");
document.querySelectorAll("[data-food]").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("food--selected");
    if (btn.classList.contains("food--selected")) blip(540);
    foodHint.textContent = "";
  });
});
document.getElementById("foodNextBtn").addEventListener("click", () => {
  const selected = [...document.querySelectorAll("[data-food].food--selected")]
    .map((b) => b.dataset.food);
  if (selected.length === 0) {
    foodHint.textContent = "Выбери хотя бы один вариант 🥺";
    return;
  }
  state.food = selected;
  blip();
  nextRoute();
});

/* ---------- Шаг 4.5: напитки ---------- */
const drinkHint = document.getElementById("drinkHint");
let customDrink = "";
document.querySelectorAll("[data-drink]").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("food--selected");
    if (btn.classList.contains("food--selected")) blip(580);
    drinkHint.textContent = "";
  });
});

// модалка «свой напиток»
const modal = document.getElementById("customModal");
const customBtn = document.getElementById("customDrinkBtn");
const customInput = document.getElementById("customDrinkInput");
function openModal() {
  modal.hidden = false;
  customInput.value = customDrink;
  setTimeout(() => customInput.focus(), 50);
  blip(620);
}
function closeModal() { modal.hidden = true; }
customBtn.addEventListener("click", openModal);
document.getElementById("customCancel").addEventListener("click", () => {
  closeModal();
  if (!customDrink) customBtn.classList.remove("food--selected");
});
document.getElementById("customOk").addEventListener("click", () => {
  customDrink = customInput.value.trim();
  if (customDrink) {
    customBtn.classList.add("food--selected");
    customBtn.querySelector("span").textContent = customDrink;
    blip(660);
  } else {
    customBtn.classList.remove("food--selected");
    customBtn.querySelector("span").textContent = "Свой напиток";
  }
  closeModal();
  drinkHint.textContent = "";
});
customInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("customOk").click();
});
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

document.getElementById("drinkNextBtn").addEventListener("click", () => {
  const selected = [...document.querySelectorAll("[data-drink].food--selected")]
    .map((b) => b.dataset.drink);
  if (customDrink) selected.push("🍹 " + customDrink);
  if (selected.length === 0) {
    drinkHint.textContent = "Выбери хотя бы один вариант 🥺";
    return;
  }
  state.drinks = selected;
  blip();
  nextRoute();
});

/* ---------- Шаг 5: пожелания ---------- */
const wishInput = document.getElementById("wishInput");
document.getElementById("wishNextBtn").addEventListener("click", () => {
  state.wishes = wishInput.value.trim();
  blip();
  nextRoute();
});
document.getElementById("wishSkipBtn").addEventListener("click", () => {
  state.wishes = "";
  blip(500);
  nextRoute();
});

/* ---------- финал ---------- */
function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

let countdownTimer = null;
function startCountdown() {
  const target = new Date(`${state.date}T${state.time}:00`);
  const el = document.getElementById("countdown");
  function tick() {
    const diff = target - new Date();
    if (diff <= 0) {
      el.textContent = "уже сегодня! 🎉";
      clearInterval(countdownTimer);
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    const dd = d > 0 ? `${d} дн ` : "";
    el.textContent = `${dd}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  tick();
  clearInterval(countdownTimer);
  countdownTimer = setInterval(tick, 1000);
}

function renderTicket() {
  document.getElementById("tDate").textContent = formatDate(state.date);
  document.getElementById("tTime").textContent = state.time;
  document.getElementById("tAct").textContent = state.activity.join(", ");
  // эмодзи-бейдж в шапке открытки — отражает выбор активности
  document.getElementById("ticketEmoji").textContent = emojiOf(state.activity);

  const rowFood = document.getElementById("rowFood");
  const rowDrinks = document.getElementById("rowDrinks");
  if (state.food.length) {
    document.getElementById("tFood").textContent = state.food.join(", ");
    rowFood.style.display = "";
  } else {
    rowFood.style.display = "none";
  }
  if (state.drinks.length) {
    document.getElementById("tDrinks").textContent = state.drinks.join(", ");
    rowDrinks.style.display = "";
  } else {
    rowDrinks.style.display = "none";
  }

  const rowWish = document.getElementById("rowWish");
  if (state.wishes) {
    document.getElementById("tWish").textContent = state.wishes;
    rowWish.style.display = "";
  } else {
    rowWish.style.display = "none";
  }

  document.getElementById("finalText").textContent = buildFinalLine();
  document.getElementById("finalSub").textContent = buildFinalSub();
  startCountdown();
}

// --- динамика B: фраза собирается из её ответов ---
function emojiOf(arr) {
  // вытащить эмодзи из вариантов вида "🍕 Пицца"
  return arr.map((s) => s.trim().split(" ")[0]).join("");
}
function buildFinalLine() {
  const who = NAME ? `${NAME}, ` : "";
  const when = `${formatDate(state.date)} в ${state.time}`;
  const acts = state.activity;
  // тон под активность
  if (acts.includes("🍿 Netflix & chill")) {
    return `${who}${when} — кино, плед и мы вдвоём 🍿❤️`;
  }
  if (acts.includes("🍷 Выпьем")) {
    return `${who}${when} — бокал за нас 🥂 не опаздывай!`;
  }
  if (acts.includes("🚶 Прогулка")) {
    return `${who}увидимся ${when} — погуляем и обо всём поболтаем 🌆`;
  }
  if (acts.includes("🎬 Кино")) {
    return `${who}${when} — большой экран и попкорн ждут 🎬🍿`;
  }
  return `${who}увидимся ${when} 🥹`;
}
function buildFinalSub() {
  // вторая строка — отражает конкретный выбор еды/напитков
  const bits = [];
  if (state.food.length) bits.push(`${emojiOf(state.food)} вкусно поедим`);
  if (state.drinks.length) bits.push(`${emojiOf(state.drinks)} и выпьем`);
  if (bits.length) return bits.join(", ") + " 😋";
  if (state.activity.includes("🎮 Игры")) return "готовь свой геймпад 🎮";
  return "не забудь хорошее настроение 💕";
}

async function finish() {
  saveState();
  renderTicket();
  goto("done");
  burstConfetti(180);
  blip(990, 0.2);
  await sendToTelegram();
}

async function sendToTelegram() {
  const payload = {
    date: formatDate(state.date),
    time: state.time,
    activity: state.activity.join(", "),
    food: state.food.join(", "),
    drinks: state.drinks.join(", "),
    wishes: state.wishes,
  };
  if (!PROXY_URL) {
    console.log("PROXY_URL не задан. Данные:", payload);
    return;
  }
  try {
    await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("Не удалось отправить:", err);
  }
}

/* ---------- .ics в календарь ---------- */
function pad(n) { return String(n).padStart(2, "0"); }
function toICSDate(d) {
  return (
    d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
    "T" + pad(d.getHours()) + pad(d.getMinutes()) + "00"
  );
}
document.getElementById("icsBtn").addEventListener("click", () => {
  const start = new Date(`${state.date}T${state.time}:00`);
  const end = new Date(start.getTime() + 2 * 3600000);
  const parts = [`Занятие: ${state.activity.join(", ")}`];
  if (state.food.length) parts.push(`Еда: ${state.food.join(", ")}`);
  if (state.drinks.length) parts.push(`Напитки: ${state.drinks.join(", ")}`);
  if (state.wishes) parts.push(`Пожелания: ${state.wishes}`);
  const desc = parts.join("\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//date-invite//RU",
    "BEGIN:VEVENT", `UID:${Date.now()}@date-invite`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(start)}`, `DTEND:${toICSDate(end)}`,
    "SUMMARY:💌 Наше свидание", `DESCRIPTION:${desc}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "svidanie.ics";
  a.click();
  URL.revokeObjectURL(a.href);
});

/* ---------- память / возврат ---------- */
function saveState() {
  try { localStorage.setItem("dateState", JSON.stringify(state)); } catch (_) {}
}
document.getElementById("resetBtn").addEventListener("click", () => {
  try { localStorage.removeItem("dateState"); } catch (_) {}
  location.reload();
});

(function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem("dateState") || "null");
    if (saved && saved.date && saved.time) {
      Object.assign(state, { food: [], drinks: [], activity: [], wishes: "" }, saved);
      renderTicket();
      goto("done");
    }
  } catch (_) {}
})();

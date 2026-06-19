// ====== НАСТРОЙКА ======
// Сюда вставь URL своего Cloudflare Worker (см. worker.js и README).
// Пока пусто — данные просто покажутся в консоли и не отправятся.
const PROXY_URL = "https://proxy-willyougowihme.aviator1112.workers.dev";
// =======================

const steps = document.querySelectorAll(".step");
function goto(name) {
  steps.forEach((s) =>
    s.classList.toggle("step--active", s.dataset.step === name),
  );
}

const state = { date: "", time: "", food: [] };

// --- Шаг 1: вопрос ---
const yesBtn = document.getElementById("yesBtn");
const noBtn = document.getElementById("noBtn");

yesBtn.addEventListener("click", () => goto("yay"));

const yayNextBtn = document.getElementById("yayNextBtn");
yayNextBtn.addEventListener("click", () => goto("when"));

// убегающая кнопка "Нет"
function runAway() {
  const pad = 8;
  const maxX = window.innerWidth - noBtn.offsetWidth - pad;
  const maxY = window.innerHeight - noBtn.offsetHeight - pad;
  noBtn.style.position = "fixed";
  noBtn.style.left = Math.max(pad, Math.floor(Math.random() * maxX)) + "px";
  noBtn.style.top = Math.max(pad, Math.floor(Math.random() * maxY)) + "px";
}
noBtn.addEventListener("mouseover", runAway);
noBtn.addEventListener("click", runAway);
noBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  runAway();
});

// --- Шаг 2: дата и время ---
const dateInput = document.getElementById("dateInput");
const timeInput = document.getElementById("timeInput");
const whenNextBtn = document.getElementById("whenNextBtn");
const whenHint = document.getElementById("whenHint");

// не дать выбрать прошедшую дату
dateInput.min = new Date().toISOString().split("T")[0];

whenNextBtn.addEventListener("click", () => {
  if (!dateInput.value || !timeInput.value) {
    whenHint.textContent = "Выбери, пожалуйста, дату и время 🙂";
    return;
  }
  whenHint.textContent = "";
  state.date = dateInput.value;
  state.time = timeInput.value;
  goto("food");
});

// --- Шаг 3: еда (можно несколько) ---
const foodHint = document.getElementById("foodHint");
const foodNextBtn = document.getElementById("foodNextBtn");

document.querySelectorAll(".food").forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.classList.toggle("food--selected");
    foodHint.textContent = "";
  });
});

foodNextBtn.addEventListener("click", () => {
  const selected = [...document.querySelectorAll(".food--selected")].map(
    (b) => b.dataset.food,
  );
  if (selected.length === 0) {
    foodHint.textContent = "Выбери хотя бы один вариант 🥺";
    return;
  }
  state.food = selected;
  foodHint.textContent = "Отправляю… 💌";
  finish();
});

// --- Шаг 4: финал + отправка ---
function formatDate(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

async function finish() {
  const prettyDate = formatDate(state.date);
  document.getElementById("finalText").textContent =
    `Увидимся с тобой ${prettyDate} в ${state.time} 🥹`;

  await sendToTelegram();
  goto("done");
}

async function sendToTelegram() {
  const payload = {
    date: formatDate(state.date),
    time: state.time,
    food: state.food.join(", "),
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

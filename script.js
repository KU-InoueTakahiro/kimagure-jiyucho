"use strict";

// --------------------------------------------------
// 外部サービスのURL（公開前に実際のURLへ変更してください）
// TODO: X / YouTube / ふりーむのURLを正式なものに変更する
// --------------------------------------------------
const socialLinks = [
  { label: "X", url: "https://x.com/" },
  { label: "YouTube", url: "https://www.youtube.com/" },
  { label: "ふりーむ", url: "https://www.freem.ne.jp/" },
];

// --------------------------------------------------
// 作品データ
// 新しい作品はここに追加
// imageを空文字にすると、自動でプレースホルダーを表示します。
// category: "game" / "illustration" / "music"
// 不要なダミー作品は、この配列から該当の { ... } を削除してください。
// --------------------------------------------------
const works = [
  {
    title: "とんでもないバカが大学を目指すRPG",
    category: "game",
    description: "勉強とは無縁だった主人公が、なぜか大学合格を目指すことになるコミカルRPG。鋭意制作中です。",
    image: "",
    imageAlt: "とんでもないバカが大学を目指すRPGのイメージ画像",
    year: "制作中",
    links: [],
  },
  // ↓ レイアウト確認用ダミー作品（公開時に削除できます）
  {
    title: "放課後の小さな冒険",
    category: "game",
    description: "いつもの帰り道で不思議な落とし物を見つける、短編アドベンチャーゲーム。",
    image: "",
    imageAlt: "放課後の小さな冒険のイメージ画像",
    year: "2025",
    links: [
      { label: "ふりーむで遊ぶ", url: "https://www.freem.ne.jp/" },
      { label: "紹介動画を見る", url: "https://www.youtube.com/" },
    ],
  },
  {
    title: "雨あがりの帰り道",
    category: "illustration",
    description: "水たまりに映る空と、雨上がりのやわらかな光を描いた一枚。",
    image: "",
    imageAlt: "雨あがりの帰り道のイラスト",
    year: "2025",
    links: [],
  },
  {
    title: "夜ふかしスケッチ",
    category: "illustration",
    description: "眠れない夜に描きためた、静かな部屋と小物のスケッチ。",
    image: "",
    imageAlt: "夜ふかしスケッチのイラスト",
    year: "2024",
    links: [],
  },
  {
    title: "ノートのすみのメロディ",
    category: "music",
    description: "鉛筆を走らせる午後をイメージした、穏やかなインストゥルメンタル。",
    image: "",
    imageAlt: "ノートのすみのメロディのジャケット画像",
    year: "2025",
    links: [{ label: "YouTubeで聴く", url: "https://www.youtube.com/" }],
  },
  {
    title: "気まぐれな朝",
    category: "music",
    description: "少し寝坊した朝の、慌ただしくも楽しい気分を詰め込んだ楽曲。",
    image: "",
    imageAlt: "気まぐれな朝のジャケット画像",
    year: "2024",
    links: [{ label: "YouTubeで聴く", url: "https://www.youtube.com/" }],
  },
];

const categoryInfo = {
  game: { label: "ゲーム", placeholder: "GAME", icon: "◇" },
  illustration: { label: "イラスト", placeholder: "ILLUSTRATION", icon: "✎" },
  music: { label: "楽曲", placeholder: "MUSIC", icon: "♪" },
};

const worksGrid = document.querySelector("#works-grid");
const filterStatus = document.querySelector("#filter-status");

/** 文字列をHTMLとして解釈させないためのエスケープ */
function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value);
  return element.innerHTML;
}

function createVisual(work) {
  if (work.image) {
    return `<img class="work-card__image" src="${escapeHtml(work.image)}" alt="${escapeHtml(work.imageAlt || work.title)}" loading="lazy">`;
  }

  const info = categoryInfo[work.category];
  return `
    <div class="work-card__placeholder work-card__placeholder--${work.category}" role="img" aria-label="${escapeHtml(work.imageAlt || `${work.title}の画像は準備中です`)}">
      <span><span class="work-card__placeholder-icon" aria-hidden="true">${info.icon}</span><span class="work-card__placeholder-text">${info.placeholder}</span></span>
    </div>`;
}

function createLinks(links = []) {
  if (!links.length) return "";

  return `<div class="work-card__links">${links.map((link) => `
    <a class="work-card__link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">
      ${escapeHtml(link.label)} <span aria-hidden="true">↗</span>
    </a>`).join("")}</div>`;
}

function createWorkCard(work) {
  const info = categoryInfo[work.category];
  return `
    <article class="work-card is-entering" data-category="${work.category}">
      <div class="work-card__visual">${createVisual(work)}</div>
      <div class="work-card__body">
        <div class="work-card__meta">
          <span class="work-card__category">${info.label}</span>
          <span class="work-card__year">${escapeHtml(work.year)}</span>
        </div>
        <h3 class="work-card__title">${escapeHtml(work.title)}</h3>
        <p class="work-card__description">${escapeHtml(work.description)}</p>
        ${createLinks(work.links)}
      </div>
    </article>`;
}

function renderWorks(filter = "all") {
  const visibleWorks = filter === "all"
    ? works
    : works.filter((work) => work.category === filter);

  worksGrid.innerHTML = visibleWorks.map(createWorkCard).join("");
  filterStatus.textContent = `${visibleWorks.length}件の作品を表示しています。`;

  requestAnimationFrame(() => {
    worksGrid.querySelectorAll(".work-card").forEach((card, index) => {
      window.setTimeout(() => card.classList.remove("is-entering"), index * 45);
    });
  });
}

document.querySelectorAll(".filter-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-button").forEach((item) => {
      const isSelected = item === button;
      item.classList.toggle("is-active", isSelected);
      item.setAttribute("aria-pressed", String(isSelected));
    });
    renderWorks(button.dataset.filter);
  });
});

function renderSocialLinks() {
  const markup = socialLinks.map((link) => `
    <a class="social-link" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(link.label)}を新しいタブで開く">
      ${escapeHtml(link.label)} <span class="social-link__arrow" aria-hidden="true">↗</span>
    </a>`).join("");

  document.querySelectorAll("[data-social-links]").forEach((container) => {
    container.innerHTML = markup;
  });
}

document.querySelector("#copyright-year").textContent = new Date().getFullYear();
renderSocialLinks();
renderWorks();

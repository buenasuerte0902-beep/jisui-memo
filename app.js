(() => {
  'use strict';

  const STORAGE_KEY = 'jisui_memo_data_v1';

  /** @typedef {{id:string, name:string, memo:string, flyerUrl:string, createdAt:string}} Store */
  /** @typedef {{id:string, storeId:string, name:string, price:number, unit:string, note:string, date:string, createdAt:string}} Item */
  /** @typedef {{id:string, name:string, qty:string, checked:boolean, createdAt:string}} ShoppingItem */
  /** @typedef {{id:string, name:string, qty:string, group:string}} Ingredient */
  /** @typedef {{id:string, text:string, group:string}} Step */
  /** @typedef {{id:string, name:string, servings:string, ingredients:Ingredient[], steps:Step[], groupOrder:string[], createdAt:string}} Recipe */

  // Recipes from before servings/steps existed had a single freeform "memo"
  // field; fold it into a one-item steps list so old data keeps showing.
  // Ingredients/steps from before groups existed get group:'' (ungrouped).
  // groupOrder is the shared, user-reorderable display order of non-empty
  // group names across both ingredients and steps; recipes saved before it
  // existed get one rebuilt from whatever order the groups first appear in.
  function migrateRecipe(recipe) {
    const ingredients = (Array.isArray(recipe.ingredients) ? recipe.ingredients : [])
      .map((i) => ({ id: i.id, name: i.name, qty: i.qty || '', group: i.group || '' }));
    const steps = (Array.isArray(recipe.steps)
      ? recipe.steps
      : (recipe.memo ? [{ id: uid(), text: recipe.memo }] : [])
    ).map((s) => ({ id: s.id, text: s.text, group: s.group || '' }));

    let groupOrder = Array.isArray(recipe.groupOrder) ? recipe.groupOrder.slice() : null;
    if (!groupOrder) {
      groupOrder = [];
      for (const g of [...ingredients.map((i) => i.group), ...steps.map((s) => s.group)]) {
        if (g && !groupOrder.includes(g)) groupOrder.push(g);
      }
    }

    return {
      id: recipe.id,
      name: recipe.name,
      servings: recipe.servings || '',
      ingredients,
      steps,
      groupOrder,
      createdAt: recipe.createdAt,
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { stores: [], items: [], shoppingList: [], recipes: [] };
      const parsed = JSON.parse(raw);
      return {
        stores: Array.isArray(parsed.stores) ? parsed.stores : [],
        items: Array.isArray(parsed.items) ? parsed.items : [],
        shoppingList: Array.isArray(parsed.shoppingList) ? parsed.shoppingList : [],
        recipes: (Array.isArray(parsed.recipes) ? parsed.recipes : []).map(migrateRecipe),
      };
    } catch (e) {
      console.error('Failed to load data', e);
      return { stores: [], items: [], shoppingList: [], recipes: [] };
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Opens Shufoo!'s own store-name search (a normal, ToS-safe use of their
  // site) so the user can find and copy their store's flyer page URL
  // themselves — this app never fetches or stores Shufoo's page content.
  function openShufooSearch(name) {
    if (!name) {
      alert('先に店舗名を入力してください。');
      return;
    }
    const url = 'https://www.shufoo.net/pntweb/shopNameSearchList/?keyword=' + encodeURIComponent(name);
    window.open(url, '_blank', 'noopener');
  }

  // ---------- Reference price data ----------
  // A small built-in table of rough, nationwide-average Japan grocery prices,
  // used ONLY as a fallback when the user hasn't recorded a real price for an
  // ingredient. These are AI-estimated ballpark figures, not live data from
  // any store — always shown with a "参考" badge so they're never confused
  // with the user's own recorded prices. Units match the app's own unit list
  // (1個/1パック/1袋/1本/100g/100ml/1kg/1L) so they plug into the same
  // per-unit cost math as user-recorded items.
  const REFERENCE_PRICES = [
    // 肉
    { name: '豚こま肉', unit: '100g', price: 130 },
    { name: '豚バラ肉', unit: '100g', price: 150 },
    { name: '豚ロース肉', unit: '100g', price: 160 },
    { name: '豚ひき肉', unit: '100g', price: 130 },
    { name: '鶏むね肉', unit: '100g', price: 70 },
    { name: '鶏もも肉', unit: '100g', price: 120 },
    { name: '鶏ささみ', unit: '100g', price: 90 },
    { name: '鶏ひき肉', unit: '100g', price: 100 },
    { name: '牛こま肉', unit: '100g', price: 200 },
    { name: '牛バラ肉', unit: '100g', price: 250 },
    { name: '合挽き肉', unit: '100g', price: 120 },
    { name: 'ベーコン', unit: '1パック', price: 250 },
    { name: 'ウインナー', unit: '1パック', price: 220 },
    { name: 'ハム', unit: '1パック', price: 200 },
    // 魚介
    { name: '鮭', unit: '1パック', price: 350 },
    { name: 'サバ', unit: '1パック', price: 300 },
    { name: 'まぐろ', unit: '1パック', price: 400 },
    { name: 'えび', unit: '1パック', price: 400 },
    { name: 'いか', unit: '1パック', price: 250 },
    { name: 'ツナ缶', unit: '1個', price: 100 },
    { name: '鯖缶', unit: '1個', price: 150 },
    // 卵・乳製品
    { name: '卵', unit: '1パック', price: 250 },
    { name: '牛乳', unit: '1L', price: 220 },
    { name: 'ヨーグルト', unit: '1パック', price: 150 },
    { name: 'バター', unit: '1個', price: 350 },
    { name: 'スライスチーズ', unit: '1パック', price: 250 },
    { name: '生クリーム', unit: '1パック', price: 250 },
    // 野菜
    { name: '玉ねぎ', unit: '1個', price: 40 },
    { name: 'じゃがいも', unit: '1個', price: 40 },
    { name: 'にんじん', unit: '1個', price: 40 },
    { name: 'キャベツ', unit: '1個', price: 180 },
    { name: '白菜', unit: '1個', price: 250 },
    { name: 'レタス', unit: '1個', price: 150 },
    { name: 'きゅうり', unit: '1本', price: 40 },
    { name: 'トマト', unit: '1個', price: 60 },
    { name: 'ミニトマト', unit: '1パック', price: 250 },
    { name: 'なす', unit: '1本', price: 40 },
    { name: 'ピーマン', unit: '1袋', price: 100 },
    { name: 'ほうれん草', unit: '1袋', price: 150 },
    { name: '小松菜', unit: '1袋', price: 120 },
    { name: 'もやし', unit: '1袋', price: 30 },
    { name: 'ねぎ', unit: '1本', price: 100 },
    { name: '大根', unit: '1本', price: 150 },
    { name: 'ごぼう', unit: '1本', price: 130 },
    { name: 'しめじ', unit: '1パック', price: 100 },
    { name: 'えのき', unit: '1パック', price: 80 },
    { name: 'しいたけ', unit: '1パック', price: 200 },
    { name: 'にんにく', unit: '1個', price: 60 },
    { name: 'しょうが', unit: '1個', price: 60 },
    { name: 'アボカド', unit: '1個', price: 150 },
    { name: 'ブロッコリー', unit: '1個', price: 200 },
    { name: 'かぼちゃ', unit: '1個', price: 200 },
    // 果物
    { name: 'バナナ', unit: '1袋', price: 150 },
    { name: 'りんご', unit: '1個', price: 100 },
    { name: 'みかん', unit: '1袋', price: 300 },
    { name: 'いちご', unit: '1パック', price: 400 },
    { name: 'ぶどう', unit: '1袋', price: 400 },
    { name: 'レモン', unit: '1個', price: 70 },
    // 米・パン・麺
    { name: '米', unit: '1kg', price: 600 },
    { name: '食パン', unit: '1袋', price: 180 },
    { name: 'うどん', unit: '1パック', price: 100 },
    { name: 'そば', unit: '1袋', price: 200 },
    { name: 'パスタ', unit: '1袋', price: 200 },
    { name: '中華麺', unit: '1パック', price: 100 },
    // 豆腐・大豆製品
    { name: '絹豆腐', unit: '1個', price: 50 },
    { name: '木綿豆腐', unit: '1個', price: 50 },
    { name: '納豆', unit: '1パック', price: 100 },
    { name: '油揚げ', unit: '1パック', price: 100 },
    // 調味料
    { name: '醤油', unit: '1本', price: 300 },
    { name: '味噌', unit: '1個', price: 350 },
    { name: 'みりん', unit: '1本', price: 300 },
    { name: '料理酒', unit: '1本', price: 250 },
    { name: '砂糖', unit: '1kg', price: 250 },
    { name: '塩', unit: '1袋', price: 150 },
    { name: 'サラダ油', unit: '1本', price: 350 },
    { name: 'ごま油', unit: '1本', price: 400 },
    { name: 'オリーブオイル', unit: '1本', price: 400 },
    { name: '生ハム', unit: '1パック', price: 300 },
    { name: 'はちみつ', unit: '1本', price: 400 },
    { name: '粉チーズ', unit: '1個', price: 300 },
    { name: 'パセリ', unit: '1袋', price: 100 },
    { name: '豆乳', unit: '1L', price: 250 },
    { name: '顆粒だし', unit: '1個', price: 300 },
    { name: '白だし', unit: '1本', price: 350 },
    { name: '酢', unit: '1本', price: 250 },
    { name: 'マヨネーズ', unit: '1本', price: 300 },
    { name: 'ケチャップ', unit: '1本', price: 250 },
    { name: '中濃ソース', unit: '1本', price: 250 },
    { name: 'コンソメ', unit: '1個', price: 200 },
    { name: '鶏がらスープの素', unit: '1個', price: 250 },
    { name: 'カレールー', unit: '1個', price: 250 },
    { name: 'めんつゆ', unit: '1本', price: 300 },
    { name: 'ポン酢', unit: '1本', price: 250 },
    // その他
    { name: '春雨', unit: '1袋', price: 150 },
    { name: '切り餅', unit: '1袋', price: 300 },
    { name: 'パン粉', unit: '1袋', price: 150 },
    { name: '片栗粉', unit: '1袋', price: 150 },
    { name: '小麦粉', unit: '1袋', price: 200 },
  ];

  function findReferencePrice(name) {
    const q = name.trim().toLowerCase();
    if (!q) return null;
    // Prefer an exact name match, then fall back to substring matching
    // (either direction) so e.g. "国産豚こま肉" still finds "豚こま肉".
    const exact = REFERENCE_PRICES.find((r) => r.name.toLowerCase() === q);
    if (exact) return exact;
    return REFERENCE_PRICES.find((r) => q.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(q)) || null;
  }

  // Converts a reference/recorded price + its unit into a per-base-unit rate
  // (per gram, per ml, or per piece) so it can be scaled to an arbitrary qty.
  function unitToRate(unit, price) {
    switch (unit) {
      case '100g': return { type: 'weight', rate: price / 100 };
      case '1kg': return { type: 'weight', rate: price / 1000 };
      case '100ml': return { type: 'volume', rate: price / 100 };
      case '1L': return { type: 'volume', rate: price / 1000 };
      default: return { type: 'piece', rate: price };
    }
  }

  // Parses a freeform quantity string (e.g. "200g", "1個", "大さじ2") into a
  // base-unit amount. Returns null when it can't confidently parse a number.
  function parseQty(qtyStr) {
    if (!qtyStr) return null;
    const m = qtyStr.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(kg|g|l|ml|cc|個|コ|パック|本|袋|枚|玉|片|かけ|束)?/i);
    if (!m) return null;
    const amount = parseFloat(m[1]);
    if (!Number.isFinite(amount)) return null;
    const unit = (m[2] || '').toLowerCase();
    if (unit === 'kg') return { type: 'weight', amount: amount * 1000 };
    if (unit === 'g') return { type: 'weight', amount };
    if (unit === 'l') return { type: 'volume', amount: amount * 1000 };
    if (unit === 'ml' || unit === 'cc') return { type: 'volume', amount };
    // No recognized unit suffix (e.g. a bare "2", or a kanji piece-counter
    // word) — treat as a plain piece count.
    return { type: 'piece', amount };
  }

  // Estimates one ingredient's cost: prefers the user's own cheapest recorded
  // price for that name, falls back to the reference table, then scales by
  // the ingredient's qty when the units are compatible. Returns cost:null
  // when there's no price data at all for this ingredient.
  function estimateIngredientCost(ing) {
    const userResults = getComparisonResults(ing.name);
    let source;
    if (userResults.length > 0) {
      source = { price: userResults[0].price, unit: userResults[0].unit, kind: 'user' };
    } else {
      const ref = findReferencePrice(ing.name);
      if (!ref) return { cost: null, source: null, rough: false };
      source = { price: ref.price, unit: ref.unit, kind: 'reference' };
    }

    const rate = unitToRate(source.unit, source.price);
    const qty = parseQty(ing.qty);
    if (qty && qty.type === rate.type) {
      return { cost: rate.rate * qty.amount, source, rough: false };
    }
    // Unit mismatch or unparseable qty: fall back to a flat one-unit estimate
    // (e.g. "1個"/"100g"/"100ml" worth) and flag it as a rough guess.
    const flatAmount = rate.type === 'piece' ? 1 : 100;
    return { cost: rate.rate * flatAmount, source, rough: true };
  }

  function todayStr() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}`;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const state = {
    data: loadData(),
    currentStoreId: null,
    currentRecipeId: null,
    currentView: 'stores',
    editingStoreId: null,
  };

  // ---------- Toast ----------
  let toastTimer = null;
  function showToast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    el.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.classList.add('hidden'), 200);
    }, 1800);
  }

  // ---------- View switching ----------
  function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    if (view === 'compare') renderCompare();
    if (view === 'shopping') renderShoppingList();
    if (view === 'recipes') {
      state.currentRecipeId = null;
      document.getElementById('recipeDetailScreen').classList.add('hidden');
      document.getElementById('recipeListScreen').classList.remove('hidden');
      renderRecipeList();
    }
  }

  document.getElementById('tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchView(btn.dataset.view);
  });

  // ---------- Store list ----------
  function renderStoreList() {
    const listEl = document.getElementById('storeList');
    const emptyEl = document.getElementById('storeEmpty');
    const stores = [...state.data.stores].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', stores.length > 0);

    for (const store of stores) {
      const li = document.createElement('li');

      if (store.id === state.editingStoreId) {
        li.className = 'list-item editing';
        li.innerHTML = `
          <input type="text" class="edit-store-name" value="${escapeHtml(store.name)}" placeholder="店舗名">
          <input type="text" class="edit-store-memo" value="${escapeHtml(store.memo || '')}" placeholder="場所・メモ（任意）">
          <div class="flyer-input-row">
            <input type="url" class="edit-store-flyer" value="${escapeHtml(store.flyerUrl || '')}" placeholder="チラシURL（任意、例: Shufoo!のページ）">
            <button type="button" class="btn-secondary" data-action="search-flyer-inline" title="Shufoo!で店舗名を検索">🔍</button>
          </div>
          <div class="btn-row">
            <button class="btn-primary" data-action="save-store-edit" data-id="${store.id}">保存</button>
            <button class="btn-secondary" data-action="cancel-store-edit">キャンセル</button>
          </div>
        `;
        listEl.appendChild(li);
        continue;
      }

      const count = state.data.items.filter((i) => i.storeId === store.id).length;
      li.className = 'list-item';
      li.innerHTML = `
        <div class="list-item-main">
          <div class="list-item-title">${escapeHtml(store.name)}</div>
          <div class="list-item-sub">${escapeHtml(store.memo || '')}${store.memo ? ' ・ ' : ''}記録 ${count}件</div>
        </div>
        <div class="item-actions">
          ${store.flyerUrl ? `<a class="icon-btn" href="${escapeHtml(store.flyerUrl)}" target="_blank" rel="noopener noreferrer" title="チラシを見る" onclick="event.stopPropagation()">🛒</a>` : ''}
          <button class="icon-btn" data-action="edit-store" data-id="${store.id}" title="編集">✏️</button>
          <button class="icon-btn" data-action="delete-store" data-id="${store.id}" title="削除">🗑</button>
        </div>
      `;
      li.querySelector('.list-item-main').addEventListener('click', () => openStoreDetail(store.id));
      listEl.appendChild(li);
    }

    listEl.querySelectorAll('[data-action="edit-store"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.editingStoreId = btn.dataset.id;
        renderStoreList();
      });
    });

    listEl.querySelectorAll('[data-action="search-flyer-inline"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const li = btn.closest('.list-item');
        openShufooSearch(li.querySelector('.edit-store-name').value.trim());
      });
    });

    listEl.querySelectorAll('[data-action="cancel-store-edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.editingStoreId = null;
        renderStoreList();
      });
    });

    listEl.querySelectorAll('[data-action="save-store-edit"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const store = state.data.stores.find((s) => s.id === id);
        if (!store) return;
        const li = btn.closest('.list-item');
        const name = li.querySelector('.edit-store-name').value.trim();
        const memo = li.querySelector('.edit-store-memo').value.trim();
        const flyerUrl = li.querySelector('.edit-store-flyer').value.trim();
        if (!name) return;
        store.name = name;
        store.memo = memo;
        store.flyerUrl = flyerUrl;
        saveData();
        state.editingStoreId = null;
        renderStoreList();
        showToast('店舗情報を更新しました');
      });
    });

    listEl.querySelectorAll('[data-action="delete-store"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const store = state.data.stores.find((s) => s.id === id);
        if (!store) return;
        if (!confirm(`「${store.name}」と、その記録をすべて削除しますか？`)) return;
        state.data.stores = state.data.stores.filter((s) => s.id !== id);
        state.data.items = state.data.items.filter((i) => i.storeId !== id);
        saveData();
        renderStoreList();
        showToast('店舗を削除しました');
      });
    });
  }

  document.getElementById('storeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('storeName');
    const memoEl = document.getElementById('storeMemo');
    const flyerUrlEl = document.getElementById('storeFlyerUrl');
    const name = nameEl.value.trim();
    if (!name) return;
    const store = {
      id: uid(),
      name,
      memo: memoEl.value.trim(),
      flyerUrl: flyerUrlEl.value.trim(),
      createdAt: new Date().toISOString(),
    };
    state.data.stores.push(store);
    saveData();
    nameEl.value = '';
    memoEl.value = '';
    flyerUrlEl.value = '';
    renderStoreList();
    showToast('店舗を追加しました');
  });

  document.getElementById('searchFlyerBtn').addEventListener('click', () => {
    openShufooSearch(document.getElementById('storeName').value.trim());
  });

  document.getElementById('editSearchFlyerBtn').addEventListener('click', () => {
    openShufooSearch(document.getElementById('editStoreName').value.trim());
  });

  // ---------- Store detail ----------
  function openStoreDetail(storeId) {
    state.currentStoreId = storeId;
    const store = state.data.stores.find((s) => s.id === storeId);
    if (!store) return;
    document.getElementById('storeListScreen').classList.add('hidden');
    document.getElementById('storeDetailScreen').classList.remove('hidden');
    document.getElementById('detailStoreName').textContent = store.name;
    document.getElementById('detailStoreMemo').textContent = store.memo || '';
    const flyerLink = document.getElementById('detailStoreFlyerLink');
    flyerLink.classList.toggle('hidden', !store.flyerUrl);
    flyerLink.href = store.flyerUrl || '#';
    document.getElementById('storeDetailTitle').classList.remove('hidden');
    document.getElementById('editStoreForm').classList.add('hidden');
    document.getElementById('itemDate').value = todayStr();
    document.getElementById('itemFilter').value = '';
    renderItemNameSuggestions();
    renderItemList();
  }

  document.getElementById('editStoreBtn').addEventListener('click', () => {
    const store = state.data.stores.find((s) => s.id === state.currentStoreId);
    if (!store) return;
    document.getElementById('editStoreName').value = store.name;
    document.getElementById('editStoreMemo').value = store.memo || '';
    document.getElementById('editStoreFlyerUrl').value = store.flyerUrl || '';
    document.getElementById('storeDetailTitle').classList.add('hidden');
    document.getElementById('editStoreForm').classList.remove('hidden');
    document.getElementById('editStoreName').focus();
  });

  document.getElementById('cancelEditStoreBtn').addEventListener('click', () => {
    document.getElementById('editStoreForm').classList.add('hidden');
    document.getElementById('storeDetailTitle').classList.remove('hidden');
  });

  document.getElementById('editStoreForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const store = state.data.stores.find((s) => s.id === state.currentStoreId);
    if (!store) return;
    const name = document.getElementById('editStoreName').value.trim();
    const memo = document.getElementById('editStoreMemo').value.trim();
    const flyerUrl = document.getElementById('editStoreFlyerUrl').value.trim();
    if (!name) return;
    store.name = name;
    store.memo = memo;
    store.flyerUrl = flyerUrl;
    saveData();
    document.getElementById('detailStoreName').textContent = store.name;
    document.getElementById('detailStoreMemo').textContent = store.memo || '';
    const flyerLink = document.getElementById('detailStoreFlyerLink');
    flyerLink.classList.toggle('hidden', !store.flyerUrl);
    flyerLink.href = store.flyerUrl || '#';
    document.getElementById('editStoreForm').classList.add('hidden');
    document.getElementById('storeDetailTitle').classList.remove('hidden');
    showToast('店舗情報を更新しました');
  });

  document.getElementById('backToStores').addEventListener('click', () => {
    state.currentStoreId = null;
    document.getElementById('storeDetailScreen').classList.add('hidden');
    document.getElementById('storeListScreen').classList.remove('hidden');
    renderStoreList();
  });

  function renderItemNameSuggestions() {
    const names = [...new Set(state.data.items.map((i) => i.name))].sort((a, b) => a.localeCompare(b, 'ja'));
    const dl = document.getElementById('itemNameSuggestions');
    dl.innerHTML = names.map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');
  }

  function renderItemList() {
    const listEl = document.getElementById('itemList');
    const emptyEl = document.getElementById('itemEmpty');
    const filter = document.getElementById('itemFilter').value.trim().toLowerCase();

    let items = state.data.items.filter((i) => i.storeId === state.currentStoreId);
    if (filter) items = items.filter((i) => i.name.toLowerCase().includes(filter));
    items.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt.localeCompare(a.createdAt));

    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', items.length > 0);

    for (const item of items) {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = `
        <div class="list-item-main">
          <div class="list-item-title">${escapeHtml(item.name)}</div>
          <div class="list-item-sub">${formatDate(item.date)}${item.note ? ' ・ ' + escapeHtml(item.note) : ''}</div>
        </div>
        <div class="price-tag">¥${item.price}<span style="font-weight:400;font-size:0.75rem;color:var(--color-muted)"> /${escapeHtml(item.unit)}</span></div>
        <div class="item-actions">
          <button class="icon-btn" data-action="delete-item" data-id="${item.id}" title="削除">🗑</button>
        </div>
      `;
      listEl.appendChild(li);
    }

    listEl.querySelectorAll('[data-action="delete-item"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        state.data.items = state.data.items.filter((i) => i.id !== id);
        saveData();
        renderItemList();
        showToast('記録を削除しました');
      });
    });
  }

  document.getElementById('itemFilter').addEventListener('input', renderItemList);

  document.getElementById('itemForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('itemName');
    const priceEl = document.getElementById('itemPrice');
    const unitEl = document.getElementById('itemUnit');
    const noteEl = document.getElementById('itemNote');
    const dateEl = document.getElementById('itemDate');

    const name = nameEl.value.trim();
    const price = Number(priceEl.value);
    if (!name || !Number.isFinite(price) || price < 0) return;

    const item = {
      id: uid(),
      storeId: state.currentStoreId,
      name,
      price,
      unit: unitEl.value,
      note: noteEl.value.trim(),
      date: dateEl.value || todayStr(),
      createdAt: new Date().toISOString(),
    };
    state.data.items.push(item);
    saveData();

    nameEl.value = '';
    priceEl.value = '';
    noteEl.value = '';
    dateEl.value = todayStr();
    nameEl.focus();

    renderItemNameSuggestions();
    renderItemList();
    showToast('記録しました');
  });

  // ---------- Compare logic (shared) ----------
  // For each store, take that store's most recent record matching the query (substring, case-insensitive).
  function getComparisonResults(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const matches = state.data.items.filter((i) => i.name.toLowerCase().includes(q));
    const latestByStore = new Map();
    for (const item of matches) {
      const key = item.storeId + '|' + item.name;
      const existing = latestByStore.get(key);
      if (!existing || (item.date || '') > (existing.date || '')) {
        latestByStore.set(key, item);
      }
    }
    return [...latestByStore.values()].sort((a, b) => a.price - b.price);
  }

  // ---------- Compare view ----------
  function renderCompare() {
    const query = document.getElementById('compareSearch').value;
    const listEl = document.getElementById('compareList');
    const emptyEl = document.getElementById('compareEmpty');

    const names = [...new Set(state.data.items.map((i) => i.name))].sort((a, b) => a.localeCompare(b, 'ja'));
    document.getElementById('compareSuggestions').innerHTML =
      names.map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');

    listEl.innerHTML = '';

    if (!query.trim()) {
      emptyEl.classList.remove('hidden');
      emptyEl.textContent = '品名を入力すると、登録済みの全店舗から価格を安い順に表示します。';
      return;
    }

    const results = getComparisonResults(query);

    if (results.length === 0) {
      // No recorded prices anywhere — fall back to the built-in reference
      // table so the search still gives a rough number, clearly badged as
      // an AI estimate rather than a real recorded price.
      const ref = findReferencePrice(query);
      if (ref) {
        emptyEl.classList.add('hidden');
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
          <div class="list-item-main">
            <div class="list-item-title">${escapeHtml(ref.name)}<span class="badge badge-ref">参考</span></div>
            <div class="list-item-sub">記録はまだありません。AIによる全国平均の目安です。</div>
          </div>
          <div class="price-tag">¥${ref.price}<span style="font-weight:400;font-size:0.75rem;color:var(--color-muted)"> /${escapeHtml(ref.unit)}</span></div>
        `;
        listEl.appendChild(li);
        return;
      }
      emptyEl.classList.remove('hidden');
      emptyEl.textContent = '該当する記録が見つかりません。';
      return;
    }

    emptyEl.classList.add('hidden');
    results.forEach((item, idx) => {
      const store = state.data.stores.find((s) => s.id === item.storeId);
      const li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = `
        <div class="list-item-main">
          <div class="list-item-title">${escapeHtml(item.name)}${idx === 0 ? '<span class="badge">最安</span>' : ''}</div>
          <div class="compare-store-name">${escapeHtml(store ? store.name : '不明な店舗')}</div>
          <div class="list-item-sub">${formatDate(item.date)}${item.note ? ' ・ ' + escapeHtml(item.note) : ''}</div>
        </div>
        <div class="price-tag">¥${item.price}<span style="font-weight:400;font-size:0.75rem;color:var(--color-muted)"> /${escapeHtml(item.unit)}</span></div>
      `;
      listEl.appendChild(li);
    });
  }

  document.getElementById('compareSearch').addEventListener('input', renderCompare);

  // ---------- Shopping list ----------
  function renderShoppingNameSuggestions() {
    const names = [...new Set(state.data.items.map((i) => i.name))].sort((a, b) => a.localeCompare(b, 'ja'));
    document.getElementById('shoppingNameSuggestions').innerHTML =
      names.map((n) => `<option value="${escapeHtml(n)}"></option>`).join('');
  }

  function renderShoppingList() {
    renderShoppingNameSuggestions();
    const listEl = document.getElementById('shoppingList');
    const emptyEl = document.getElementById('shoppingEmpty');
    const clearBtn = document.getElementById('clearCheckedBtn');

    const list = [...state.data.shoppingList].sort((a, b) => {
      if (a.checked !== b.checked) return a.checked ? 1 : -1;
      return b.createdAt.localeCompare(a.createdAt);
    });

    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', list.length > 0);
    clearBtn.classList.toggle('hidden', !list.some((i) => i.checked));

    for (const shopItem of list) {
      const cheapest = shopItem.checked ? null : getComparisonResults(shopItem.name)[0];
      const store = cheapest ? state.data.stores.find((s) => s.id === cheapest.storeId) : null;
      const li = document.createElement('li');
      li.className = 'list-item' + (shopItem.checked ? ' checked' : '');
      li.innerHTML = `
        <input type="checkbox" class="shopping-checkbox" data-action="toggle-shopping" data-id="${shopItem.id}" ${shopItem.checked ? 'checked' : ''}>
        <div class="list-item-main">
          <div class="list-item-title">${escapeHtml(shopItem.name)}</div>
          <div class="list-item-sub">${escapeHtml(shopItem.qty || '')}</div>
          ${cheapest && store ? `<div class="price-hint">最安の記録: ${escapeHtml(store.name)} ¥${cheapest.price}/${escapeHtml(cheapest.unit)}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-action="delete-shopping" data-id="${shopItem.id}" title="削除">🗑</button>
        </div>
      `;
      listEl.appendChild(li);
    }

    listEl.querySelectorAll('[data-action="toggle-shopping"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const id = cb.dataset.id;
        const item = state.data.shoppingList.find((i) => i.id === id);
        if (!item) return;
        item.checked = cb.checked;
        saveData();
        renderShoppingList();
      });
    });

    listEl.querySelectorAll('[data-action="delete-shopping"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        state.data.shoppingList = state.data.shoppingList.filter((i) => i.id !== id);
        saveData();
        renderShoppingList();
      });
    });
  }

  document.getElementById('shoppingForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('shoppingName');
    const qtyEl = document.getElementById('shoppingQty');
    const name = nameEl.value.trim();
    if (!name) return;

    state.data.shoppingList.push({
      id: uid(),
      name,
      qty: qtyEl.value.trim(),
      checked: false,
      createdAt: new Date().toISOString(),
    });
    saveData();

    nameEl.value = '';
    qtyEl.value = '';
    nameEl.focus();
    renderShoppingList();
  });

  document.getElementById('clearCheckedBtn').addEventListener('click', () => {
    state.data.shoppingList = state.data.shoppingList.filter((i) => !i.checked);
    saveData();
    renderShoppingList();
  });

  // ---------- Recipe list ----------
  function renderRecipeList() {
    const listEl = document.getElementById('recipeList');
    const emptyEl = document.getElementById('recipeEmpty');
    const recipes = [...state.data.recipes].sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', recipes.length > 0);

    for (const recipe of recipes) {
      const li = document.createElement('li');
      li.className = 'list-item';
      const subParts = [];
      if (recipe.servings) subParts.push(recipe.servings);
      subParts.push(`材料 ${recipe.ingredients.length}点`);
      subParts.push(`手順 ${recipe.steps.length}件`);
      li.innerHTML = `
        <div class="list-item-main">
          <div class="list-item-title">${escapeHtml(recipe.name)}</div>
          <div class="list-item-sub">${subParts.map(escapeHtml).join(' ・ ')}</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-action="delete-recipe" data-id="${recipe.id}" title="削除">🗑</button>
        </div>
      `;
      li.querySelector('.list-item-main').addEventListener('click', () => openRecipeDetail(recipe.id));
      listEl.appendChild(li);
    }

    listEl.querySelectorAll('[data-action="delete-recipe"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const recipe = state.data.recipes.find((r) => r.id === id);
        if (!recipe) return;
        if (!confirm(`「${recipe.name}」を削除しますか？`)) return;
        state.data.recipes = state.data.recipes.filter((r) => r.id !== id);
        saveData();
        renderRecipeList();
        showToast('レシピを削除しました');
      });
    });
  }

  document.getElementById('recipeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('recipeName');
    const name = nameEl.value.trim();
    if (!name) return;
    const recipe = {
      id: uid(),
      name,
      servings: '',
      ingredients: [],
      steps: [],
      groupOrder: [],
      createdAt: new Date().toISOString(),
    };
    state.data.recipes.push(recipe);
    saveData();
    nameEl.value = '';
    // Jump straight into the detail screen so the ingredients/steps can be
    // filled in right away instead of asking for everything on one form.
    openRecipeDetail(recipe.id);
  });

  // ---------- Recipe detail ----------
  function openRecipeDetail(recipeId) {
    state.currentRecipeId = recipeId;
    const recipe = state.data.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    document.getElementById('recipeListScreen').classList.add('hidden');
    document.getElementById('recipeDetailScreen').classList.remove('hidden');
    document.getElementById('detailRecipeName').textContent = recipe.name;
    document.getElementById('detailRecipeServings').textContent = recipe.servings || '';
    document.getElementById('recipeDetailTitle').classList.remove('hidden');
    document.getElementById('editRecipeForm').classList.add('hidden');
    document.getElementById('ingredientGroup').value = '';
    document.getElementById('stepGroup').value = '';
    renderItemNameSuggestions();
    renderGroupSuggestions();
    renderIngredientList();
    renderStepList();
    renderCostEstimate();
  }

  // Sums up estimateIngredientCost() across a recipe's ingredients into a
  // "推定費用" card: your own recorded prices are preferred per ingredient,
  // the reference table fills in the rest, and each row is badged so it's
  // always clear which price is really yours vs an AI ballpark.
  function renderCostEstimate() {
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    const container = document.getElementById('costEstimate');
    if (!recipe) return;

    if (recipe.ingredients.length === 0) {
      container.innerHTML = '';
      return;
    }

    let total = 0;
    let missing = 0;
    const rowsHtml = recipe.ingredients.map((ing) => {
      const { cost, source, rough } = estimateIngredientCost(ing);
      if (cost == null) {
        missing++;
        return `
          <div class="cost-row">
            <span class="cost-name">${escapeHtml(ing.name)}</span>
            <span class="cost-value muted">価格不明</span>
          </div>
        `;
      }
      total += cost;
      const badge = source.kind === 'user'
        ? '<span class="badge badge-user">記録</span>'
        : '<span class="badge badge-ref">参考</span>';
      return `
        <div class="cost-row">
          <span class="cost-name">${escapeHtml(ing.name)} ${badge}</span>
          <span class="cost-value">¥${Math.round(cost)}${rough ? '<span class="rough-mark">目安</span>' : ''}</span>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <h3 class="section-heading">💰 推定費用</h3>
      <div class="card cost-card">
        ${rowsHtml}
        <div class="cost-total">合計目安 <span>¥${Math.round(total)}</span></div>
        <p class="cost-disclaimer">
          <span class="badge badge-user">記録</span>はあなたが登録した最安値、
          <span class="badge badge-ref">参考</span>はAIによる全国平均の目安価格です（実際とは異なります）。
          ${missing > 0 ? `${missing}点は価格データがなく合計に含めていません。` : ''}
        </p>
      </div>
    `;
  }

  // Buckets items by their (optional) group, in the recipe's shared
  // groupOrder (user-reorderable). group:'' is the default, unlabeled
  // bucket and always comes first, ahead of any named group.
  function groupItems(items, groupOrder) {
    const map = new Map();
    for (const item of items) {
      const key = item.group || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    const keys = ['', ...groupOrder];
    return keys.filter((key) => map.has(key)).map((key) => ({ group: key, items: map.get(key) }));
  }

  // Registers a group name into the recipe's shared groupOrder the first
  // time it's used, so it gets a persisted, reorderable position.
  function registerGroup(recipe, group) {
    if (group && !recipe.groupOrder.includes(group)) recipe.groupOrder.push(group);
  }

  function moveGroup(recipe, group, direction) {
    const idx = recipe.groupOrder.indexOf(group);
    if (idx === -1) return;
    const swap = direction === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= recipe.groupOrder.length) return;
    [recipe.groupOrder[idx], recipe.groupOrder[swap]] = [recipe.groupOrder[swap], recipe.groupOrder[idx]];
  }

  function groupHeadingHtml(recipe, group) {
    const idx = recipe.groupOrder.indexOf(group);
    return `
      <div class="recipe-group-heading">
        <span>${escapeHtml(group)}</span>
        <span class="group-move-actions">
          <button class="icon-btn" data-action="move-group-up" data-group="${escapeHtml(group)}" title="グループを上に移動" ${idx === 0 ? 'disabled' : ''}>▲</button>
          <button class="icon-btn" data-action="move-group-down" data-group="${escapeHtml(group)}" title="グループを下に移動" ${idx === recipe.groupOrder.length - 1 ? 'disabled' : ''}>▼</button>
        </span>
      </div>
    `;
  }

  function bindGroupMoveButtons(containerEl, recipe) {
    containerEl.querySelectorAll('[data-action="move-group-up"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        moveGroup(recipe, btn.dataset.group, 'up');
        saveData();
        renderIngredientList();
        renderStepList();
      });
    });
    containerEl.querySelectorAll('[data-action="move-group-down"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        moveGroup(recipe, btn.dataset.group, 'down');
        saveData();
        renderIngredientList();
        renderStepList();
      });
    });
  }

  function renderGroupSuggestions() {
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    if (!recipe) return;
    document.getElementById('recipeGroupSuggestions').innerHTML =
      recipe.groupOrder.map((g) => `<option value="${escapeHtml(g)}"></option>`).join('');
  }

  document.getElementById('backToRecipes').addEventListener('click', () => {
    state.currentRecipeId = null;
    document.getElementById('recipeDetailScreen').classList.add('hidden');
    document.getElementById('recipeListScreen').classList.remove('hidden');
    renderRecipeList();
  });

  document.getElementById('editRecipeBtn').addEventListener('click', () => {
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    if (!recipe) return;
    document.getElementById('editRecipeName').value = recipe.name;
    document.getElementById('editRecipeServings').value = recipe.servings || '';
    document.getElementById('recipeDetailTitle').classList.add('hidden');
    document.getElementById('editRecipeForm').classList.remove('hidden');
    document.getElementById('editRecipeName').focus();
  });

  document.getElementById('cancelEditRecipeBtn').addEventListener('click', () => {
    document.getElementById('editRecipeForm').classList.add('hidden');
    document.getElementById('recipeDetailTitle').classList.remove('hidden');
  });

  document.getElementById('editRecipeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    if (!recipe) return;
    const name = document.getElementById('editRecipeName').value.trim();
    const servings = document.getElementById('editRecipeServings').value.trim();
    if (!name) return;
    recipe.name = name;
    recipe.servings = servings;
    saveData();
    document.getElementById('detailRecipeName').textContent = recipe.name;
    document.getElementById('detailRecipeServings').textContent = recipe.servings || '';
    document.getElementById('editRecipeForm').classList.add('hidden');
    document.getElementById('recipeDetailTitle').classList.remove('hidden');
    showToast('レシピを更新しました');
  });

  // ---------- Ingredients ----------
  function renderIngredientList() {
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    const containerEl = document.getElementById('ingredientGroups');
    const emptyEl = document.getElementById('ingredientEmpty');
    if (!recipe) return;

    containerEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', recipe.ingredients.length > 0);

    for (const { group, items } of groupItems(recipe.ingredients, recipe.groupOrder)) {
      const groupEl = document.createElement('div');
      groupEl.className = 'recipe-group';
      const ul = document.createElement('ul');
      ul.className = 'list ingredient-list';
      for (const ing of items) {
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
          <div class="ingredient-row">
            <span class="ingredient-name">${escapeHtml(ing.name)}</span>
            ${ing.qty ? `<span class="ingredient-qty">${escapeHtml(ing.qty)}</span>` : ''}
          </div>
          <div class="item-actions">
            <button class="icon-btn" data-action="delete-ingredient" data-id="${ing.id}" title="削除">🗑</button>
          </div>
        `;
        ul.appendChild(li);
      }
      if (group) groupEl.insertAdjacentHTML('beforeend', groupHeadingHtml(recipe, group));
      groupEl.appendChild(ul);
      containerEl.appendChild(groupEl);
    }

    containerEl.querySelectorAll('[data-action="delete-ingredient"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        recipe.ingredients = recipe.ingredients.filter((i) => i.id !== btn.dataset.id);
        saveData();
        renderIngredientList();
        renderGroupSuggestions();
        renderRecipeList();
        renderCostEstimate();
      });
    });

    bindGroupMoveButtons(containerEl, recipe);
  }

  document.getElementById('ingredientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    if (!recipe) return;
    const nameEl = document.getElementById('ingredientName');
    const qtyEl = document.getElementById('ingredientQty');
    const groupEl = document.getElementById('ingredientGroup');
    const name = nameEl.value.trim();
    if (!name) return;
    const group = groupEl.value.trim();
    registerGroup(recipe, group);
    recipe.ingredients.push({ id: uid(), name, qty: qtyEl.value.trim(), group });
    saveData();
    nameEl.value = '';
    qtyEl.value = '';
    nameEl.focus();
    // Leave the group field as-is: ingredients are usually added a few at a
    // time into the same group (e.g. all of "ドレッシング" back to back).
    renderIngredientList();
    renderGroupSuggestions();
    renderCostEstimate();
  });

  document.getElementById('addIngredientsToShoppingBtn').addEventListener('click', () => {
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    if (!recipe || recipe.ingredients.length === 0) return;
    const existingUnchecked = new Set(
      state.data.shoppingList.filter((i) => !i.checked).map((i) => i.name)
    );
    let addedCount = 0;
    for (const ing of recipe.ingredients) {
      if (existingUnchecked.has(ing.name)) continue;
      state.data.shoppingList.push({
        id: uid(),
        name: ing.name,
        qty: ing.qty || '',
        checked: false,
        createdAt: new Date().toISOString(),
      });
      existingUnchecked.add(ing.name);
      addedCount++;
    }
    saveData();
    showToast(addedCount > 0 ? `${addedCount}件を買い物リストに追加しました` : 'すべて追加済みです');
  });

  // ---------- Steps ----------
  // Moves a step up/down among only the steps that share its group (steps in
  // other groups aren't necessarily adjacent in recipe.steps, so this finds
  // the real array indices of the two group-mates being swapped).
  function moveStepWithinGroup(recipe, stepId, direction) {
    const step = recipe.steps.find((s) => s.id === stepId);
    if (!step) return;
    const groupIndices = recipe.steps
      .map((s, i) => (s.group === step.group ? i : -1))
      .filter((i) => i !== -1);
    const posInGroup = groupIndices.findIndex((i) => recipe.steps[i].id === stepId);
    const swapPos = direction === 'up' ? posInGroup - 1 : posInGroup + 1;
    if (swapPos < 0 || swapPos >= groupIndices.length) return;
    const idxA = groupIndices[posInGroup];
    const idxB = groupIndices[swapPos];
    [recipe.steps[idxA], recipe.steps[idxB]] = [recipe.steps[idxB], recipe.steps[idxA]];
  }

  function renderStepList() {
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    const containerEl = document.getElementById('stepGroups');
    const emptyEl = document.getElementById('stepEmpty');
    if (!recipe) return;

    containerEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', recipe.steps.length > 0);

    for (const { group, items } of groupItems(recipe.steps, recipe.groupOrder)) {
      const groupEl = document.createElement('div');
      groupEl.className = 'recipe-group';
      const ol = document.createElement('ol');
      ol.className = 'list step-list';
      items.forEach((step, index) => {
        const li = document.createElement('li');
        li.className = 'list-item step-item';
        li.innerHTML = `
          <div class="step-number">${index + 1}</div>
          <div class="step-text">${escapeHtml(step.text)}</div>
          <div class="step-actions">
            <button class="icon-btn" data-action="move-step-up" data-id="${step.id}" title="上に移動" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button class="icon-btn" data-action="move-step-down" data-id="${step.id}" title="下に移動" ${index === items.length - 1 ? 'disabled' : ''}>▼</button>
          </div>
          <button class="icon-btn" data-action="delete-step" data-id="${step.id}" title="削除">🗑</button>
        `;
        ol.appendChild(li);
      });
      if (group) groupEl.insertAdjacentHTML('beforeend', groupHeadingHtml(recipe, group));
      groupEl.appendChild(ol);
      containerEl.appendChild(groupEl);
    }

    containerEl.querySelectorAll('[data-action="delete-step"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        recipe.steps = recipe.steps.filter((s) => s.id !== btn.dataset.id);
        saveData();
        renderStepList();
        renderGroupSuggestions();
        renderRecipeList();
      });
    });

    containerEl.querySelectorAll('[data-action="move-step-up"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        moveStepWithinGroup(recipe, btn.dataset.id, 'up');
        saveData();
        renderStepList();
      });
    });

    containerEl.querySelectorAll('[data-action="move-step-down"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        moveStepWithinGroup(recipe, btn.dataset.id, 'down');
        saveData();
        renderStepList();
      });
    });

    bindGroupMoveButtons(containerEl, recipe);
  }

  document.getElementById('stepForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    if (!recipe) return;
    const textEl = document.getElementById('stepText');
    const groupEl = document.getElementById('stepGroup');
    const text = textEl.value.trim();
    if (!text) return;
    const group = groupEl.value.trim();
    registerGroup(recipe, group);
    recipe.steps.push({ id: uid(), text, group });
    saveData();
    textEl.value = '';
    textEl.focus();
    // Leave the group field as-is, same reasoning as the ingredient form.
    renderStepList();
    renderGroupSuggestions();
    renderRecipeList();
  });

  // ---------- Settings: export / import / clear ----------
  document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    a.href = url;
    a.download = `jisui-memo-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('エクスポートしました');
  });

  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const stores = Array.isArray(parsed.stores) ? parsed.stores : [];
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        const shoppingList = Array.isArray(parsed.shoppingList) ? parsed.shoppingList : [];
        const recipes = Array.isArray(parsed.recipes) ? parsed.recipes : [];
        if (!confirm(`店舗${stores.length}件・記録${items.length}件を読み込みます。現在のデータは上書きされます。よろしいですか？`)) return;
        state.data = { stores, items, shoppingList, recipes };
        saveData();
        renderStoreList();
        showToast('インポートしました');
      } catch (err) {
        alert('ファイルの読み込みに失敗しました。正しいJSONファイルか確認してください。');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (!confirm('すべてのデータを削除します。この操作は取り消せません。よろしいですか？')) return;
    state.data = { stores: [], items: [], shoppingList: [], recipes: [] };
    saveData();
    renderStoreList();
    showToast('全データを削除しました');
  });

  // ---------- Init ----------
  renderStoreList();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch((e) => {
        console.error('Service worker registration failed', e);
      });
    });
  }
})();

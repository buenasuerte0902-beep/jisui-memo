(() => {
  'use strict';

  const STORAGE_KEY = 'jisui_memo_data_v1';

  /** @typedef {{id:string, name:string, memo:string, flyerUrl:string, createdAt:string}} Store */
  /** @typedef {{id:string, storeId:string, name:string, price:number, unit:string, note:string, date:string, createdAt:string}} Item */
  /** @typedef {{id:string, name:string, qty:string, checked:boolean, createdAt:string}} ShoppingItem */
  /** @typedef {{id:string, name:string, qty:string}} Ingredient */
  /** @typedef {{id:string, name:string, memo:string, ingredients:Ingredient[], createdAt:string}} Recipe */

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { stores: [], items: [], shoppingList: [], recipes: [] };
      const parsed = JSON.parse(raw);
      return {
        stores: Array.isArray(parsed.stores) ? parsed.stores : [],
        items: Array.isArray(parsed.items) ? parsed.items : [],
        shoppingList: Array.isArray(parsed.shoppingList) ? parsed.shoppingList : [],
        recipes: Array.isArray(parsed.recipes) ? parsed.recipes : [],
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
          <input type="url" class="edit-store-flyer" value="${escapeHtml(store.flyerUrl || '')}" placeholder="チラシURL（任意、例: Shufoo!のページ）">
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

    emptyEl.classList.toggle('hidden', results.length > 0);
    if (results.length === 0) {
      emptyEl.classList.remove('hidden');
      emptyEl.textContent = '該当する記録が見つかりません。';
      return;
    }

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
      li.innerHTML = `
        <div class="list-item-main">
          <div class="list-item-title">${escapeHtml(recipe.name)}</div>
          <div class="list-item-sub">材料 ${recipe.ingredients.length}点</div>
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
    const memoEl = document.getElementById('recipeMemo');
    const name = nameEl.value.trim();
    if (!name) return;
    state.data.recipes.push({
      id: uid(),
      name,
      memo: memoEl.value.trim(),
      ingredients: [],
      createdAt: new Date().toISOString(),
    });
    saveData();
    nameEl.value = '';
    memoEl.value = '';
    renderRecipeList();
    showToast('レシピを追加しました');
  });

  // ---------- Recipe detail ----------
  function openRecipeDetail(recipeId) {
    state.currentRecipeId = recipeId;
    const recipe = state.data.recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    document.getElementById('recipeListScreen').classList.add('hidden');
    document.getElementById('recipeDetailScreen').classList.remove('hidden');
    document.getElementById('detailRecipeName').textContent = recipe.name;
    document.getElementById('detailRecipeMemo').textContent = recipe.memo || '';
    document.getElementById('recipeDetailTitle').classList.remove('hidden');
    document.getElementById('editRecipeForm').classList.add('hidden');
    renderItemNameSuggestions();
    renderIngredientList();
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
    document.getElementById('editRecipeMemo').value = recipe.memo || '';
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
    const memo = document.getElementById('editRecipeMemo').value.trim();
    if (!name) return;
    recipe.name = name;
    recipe.memo = memo;
    saveData();
    document.getElementById('detailRecipeName').textContent = recipe.name;
    document.getElementById('detailRecipeMemo').textContent = recipe.memo || '';
    document.getElementById('editRecipeForm').classList.add('hidden');
    document.getElementById('recipeDetailTitle').classList.remove('hidden');
    showToast('レシピを更新しました');
  });

  function renderIngredientList() {
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    const listEl = document.getElementById('ingredientList');
    const emptyEl = document.getElementById('ingredientEmpty');
    if (!recipe) return;

    listEl.innerHTML = '';
    emptyEl.classList.toggle('hidden', recipe.ingredients.length > 0);

    for (const ing of recipe.ingredients) {
      const li = document.createElement('li');
      li.className = 'list-item';
      li.innerHTML = `
        <div class="list-item-main">
          <div class="list-item-title">${escapeHtml(ing.name)}</div>
          ${ing.qty ? `<div class="list-item-sub">${escapeHtml(ing.qty)}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-action="delete-ingredient" data-id="${ing.id}" title="削除">🗑</button>
        </div>
      `;
      listEl.appendChild(li);
    }

    listEl.querySelectorAll('[data-action="delete-ingredient"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        recipe.ingredients = recipe.ingredients.filter((i) => i.id !== btn.dataset.id);
        saveData();
        renderIngredientList();
      });
    });
  }

  document.getElementById('ingredientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const recipe = state.data.recipes.find((r) => r.id === state.currentRecipeId);
    if (!recipe) return;
    const nameEl = document.getElementById('ingredientName');
    const qtyEl = document.getElementById('ingredientQty');
    const name = nameEl.value.trim();
    if (!name) return;
    recipe.ingredients.push({ id: uid(), name, qty: qtyEl.value.trim() });
    saveData();
    nameEl.value = '';
    qtyEl.value = '';
    nameEl.focus();
    renderIngredientList();
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

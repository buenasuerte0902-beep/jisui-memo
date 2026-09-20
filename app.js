(() => {
  'use strict';

  const STORAGE_KEY = 'jisui_memo_data_v1';
  // Kept separate from STORAGE_KEY on purpose: a Gemini API key is
  // per-device/personal and must never end up in the JSON export/import
  // bundle (which is meant to be moved between devices or shared).
  const GEMINI_KEY_STORAGE = 'jisui_memo_gemini_key_v1';
  const GEMINI_MODEL_STORAGE = 'jisui_memo_gemini_model_v1';
  const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

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
    { name: '豚ヒレ肉', unit: '100g', price: 180 },
    { name: '豚肩ロース肉', unit: '100g', price: 150 },
    { name: '豚もも肉', unit: '100g', price: 120 },
    { name: '豚ひき肉', unit: '100g', price: 130 },
    { name: '豚スペアリブ', unit: '100g', price: 180 },
    { name: '豚トロ', unit: '100g', price: 150 },
    { name: '豚レバー', unit: '100g', price: 80 },
    { name: '鶏むね肉', unit: '100g', price: 70 },
    { name: '鶏もも肉', unit: '100g', price: 120 },
    { name: '鶏ささみ', unit: '100g', price: 90 },
    { name: '鶏ひき肉', unit: '100g', price: 100 },
    { name: '鶏手羽先', unit: '100g', price: 100 },
    { name: '鶏手羽元', unit: '100g', price: 90 },
    { name: '鶏レバー', unit: '100g', price: 70 },
    { name: '砂肝', unit: '100g', price: 80 },
    { name: '牛こま肉', unit: '100g', price: 200 },
    { name: '牛バラ肉', unit: '100g', price: 250 },
    { name: '牛もも肉', unit: '100g', price: 220 },
    { name: '牛肩ロース肉', unit: '100g', price: 280 },
    { name: '牛ロース肉', unit: '100g', price: 350 },
    { name: '牛ヒレ肉', unit: '100g', price: 450 },
    { name: '牛タン', unit: '100g', price: 300 },
    { name: '牛すじ', unit: '100g', price: 130 },
    { name: '牛レバー', unit: '100g', price: 100 },
    { name: '合挽き肉', unit: '100g', price: 120 },
    { name: 'ラム肉', unit: '100g', price: 200 },
    { name: 'ベーコン', unit: '1パック', price: 250 },
    { name: 'ウインナー', unit: '1パック', price: 220 },
    { name: 'ソーセージ', unit: '1パック', price: 250 },
    { name: 'ハム', unit: '1パック', price: 200 },
    { name: '生ハム', unit: '1パック', price: 300 },
    { name: 'サラミ', unit: '1パック', price: 300 },
    { name: '焼き鳥（パック）', unit: '1パック', price: 300 },
    { name: '唐揚げ（惣菜）', unit: '1パック', price: 400 },
    // 魚介
    { name: '鮭', unit: '1パック', price: 350 },
    { name: '塩鮭', unit: '1パック', price: 350 },
    { name: 'サバ', unit: '1パック', price: 300 },
    { name: '塩サバ', unit: '1パック', price: 300 },
    { name: 'アジ', unit: '1パック', price: 250 },
    { name: 'イワシ', unit: '1パック', price: 200 },
    { name: 'サンマ', unit: '1本', price: 150 },
    { name: 'ブリ', unit: '1パック', price: 400 },
    { name: 'カツオ', unit: '1パック', price: 350 },
    { name: 'まぐろ', unit: '1パック', price: 400 },
    { name: '刺身盛り合わせ', unit: '1パック', price: 700 },
    { name: 'たら', unit: '1パック', price: 250 },
    { name: 'カレイ', unit: '1パック', price: 300 },
    { name: 'ヒラメ', unit: '1パック', price: 500 },
    { name: 'タイ', unit: '1パック', price: 450 },
    { name: 'うなぎ蒲焼', unit: '1パック', price: 800 },
    { name: 'あなご', unit: '1パック', price: 400 },
    { name: 'いか', unit: '1パック', price: 250 },
    { name: 'たこ', unit: '1パック', price: 400 },
    { name: 'えび', unit: '1パック', price: 400 },
    { name: 'ホタテ', unit: '1パック', price: 500 },
    { name: 'あさり', unit: '1パック', price: 250 },
    { name: 'しじみ', unit: '1パック', price: 200 },
    { name: 'かき（牡蠣）', unit: '1パック', price: 400 },
    { name: 'ツナ缶', unit: '1個', price: 100 },
    { name: '鯖缶', unit: '1個', price: 150 },
    { name: 'いわし缶', unit: '1個', price: 150 },
    { name: '明太子', unit: '1パック', price: 500 },
    { name: 'たらこ', unit: '1パック', price: 400 },
    { name: 'いくら', unit: '1パック', price: 800 },
    { name: 'ちくわ', unit: '1パック', price: 150 },
    { name: 'かまぼこ', unit: '1個', price: 200 },
    { name: 'さつま揚げ', unit: '1パック', price: 200 },
    { name: 'はんぺん', unit: '1パック', price: 150 },
    { name: 'しらす', unit: '1パック', price: 300 },
    { name: 'ちりめんじゃこ', unit: '1パック', price: 300 },
    { name: '干物', unit: '1パック', price: 350 },
    // 卵・乳製品
    { name: '卵', unit: '1パック', price: 250 },
    { name: 'うずら卵', unit: '1パック', price: 200 },
    { name: '牛乳', unit: '1L', price: 220 },
    { name: '低脂肪乳', unit: '1L', price: 200 },
    { name: '豆乳', unit: '1L', price: 250 },
    { name: 'ヨーグルト', unit: '1パック', price: 150 },
    { name: '飲むヨーグルト', unit: '1本', price: 150 },
    { name: 'バター', unit: '1個', price: 350 },
    { name: 'マーガリン', unit: '1個', price: 250 },
    { name: 'スライスチーズ', unit: '1パック', price: 250 },
    { name: 'とろけるチーズ', unit: '1パック', price: 250 },
    { name: '粉チーズ', unit: '1個', price: 300 },
    { name: 'クリームチーズ', unit: '1個', price: 350 },
    { name: 'カマンベールチーズ', unit: '1個', price: 400 },
    { name: '生クリーム', unit: '1パック', price: 250 },
    { name: 'コーヒーフレッシュ', unit: '1パック', price: 150 },
    { name: 'アイスクリーム', unit: '1個', price: 300 },
    // 野菜
    { name: '玉ねぎ', unit: '1個', price: 40 },
    { name: '新玉ねぎ', unit: '1個', price: 50 },
    { name: 'じゃがいも', unit: '1個', price: 40 },
    { name: 'さつまいも', unit: '1本', price: 100 },
    { name: '里芋', unit: '1袋', price: 200 },
    { name: '長芋', unit: '1本', price: 250 },
    { name: 'にんじん', unit: '1個', price: 40 },
    { name: 'キャベツ', unit: '1個', price: 180, piecesPerUnit: 15 },
    { name: '紫キャベツ', unit: '1個', price: 200, piecesPerUnit: 15 },
    { name: '白菜', unit: '1個', price: 250, piecesPerUnit: 15 },
    { name: 'レタス', unit: '1個', price: 150, piecesPerUnit: 10 },
    { name: 'サニーレタス', unit: '1個', price: 150, piecesPerUnit: 10 },
    { name: 'きゅうり', unit: '1本', price: 40 },
    { name: 'トマト', unit: '1個', price: 60 },
    { name: 'ミニトマト', unit: '1パック', price: 250, piecesPerUnit: 20 },
    { name: 'なす', unit: '1本', price: 40 },
    { name: 'ピーマン', unit: '1袋', price: 100 },
    { name: 'パプリカ', unit: '1個', price: 100 },
    { name: 'ゴーヤ', unit: '1本', price: 150 },
    { name: 'ズッキーニ', unit: '1本', price: 100 },
    { name: 'ほうれん草', unit: '1袋', price: 150 },
    { name: '小松菜', unit: '1袋', price: 120 },
    { name: 'チンゲン菜', unit: '1袋', price: 100 },
    { name: '水菜', unit: '1袋', price: 120 },
    { name: '春菊', unit: '1袋', price: 150 },
    { name: 'もやし', unit: '1袋', price: 30 },
    { name: 'にら', unit: '1袋', price: 100 },
    { name: 'ねぎ', unit: '1本', price: 100 },
    { name: '万能ねぎ', unit: '1袋', price: 100 },
    { name: '大根', unit: '1本', price: 150 },
    { name: 'かぶ', unit: '1袋', price: 150 },
    { name: 'ごぼう', unit: '1本', price: 130 },
    { name: 'れんこん', unit: '1袋', price: 200 },
    { name: 'しめじ', unit: '1パック', price: 100 },
    { name: 'えのき', unit: '1パック', price: 80 },
    { name: 'しいたけ', unit: '1パック', price: 200 },
    { name: 'まいたけ', unit: '1パック', price: 150 },
    { name: 'エリンギ', unit: '1パック', price: 150 },
    { name: 'マッシュルーム', unit: '1パック', price: 200 },
    { name: 'にんにく', unit: '1個', price: 60, piecesPerUnit: 8 },
    { name: 'しょうが', unit: '1個', price: 60, piecesPerUnit: 6 },
    { name: 'みょうが', unit: '1袋', price: 150, piecesPerUnit: 5 },
    { name: 'アボカド', unit: '1個', price: 150 },
    { name: 'ブロッコリー', unit: '1個', price: 200 },
    { name: 'カリフラワー', unit: '1個', price: 250 },
    { name: 'かぼちゃ', unit: '1個', price: 200 },
    { name: 'とうもろこし', unit: '1本', price: 100 },
    { name: 'オクラ', unit: '1袋', price: 150 },
    { name: 'さやいんげん', unit: '1袋', price: 150 },
    { name: 'スナップエンドウ', unit: '1袋', price: 150 },
    { name: '枝豆', unit: '1袋', price: 200 },
    { name: 'そら豆', unit: '1袋', price: 200 },
    { name: 'セロリ', unit: '1本', price: 100 },
    { name: 'パクチー', unit: '1袋', price: 150 },
    { name: 'バジル', unit: '1袋', price: 150 },
    { name: '大葉', unit: '1袋', price: 100, piecesPerUnit: 10 },
    { name: 'パセリ', unit: '1袋', price: 100 },
    { name: 'たけのこ', unit: '1個', price: 300 },
    // 果物
    { name: 'バナナ', unit: '1袋', price: 150 },
    { name: 'りんご', unit: '1個', price: 100 },
    { name: 'みかん', unit: '1袋', price: 300 },
    { name: 'いちご', unit: '1パック', price: 400 },
    { name: 'ぶどう', unit: '1袋', price: 400 },
    { name: 'レモン', unit: '1個', price: 70 },
    { name: 'グレープフルーツ', unit: '1個', price: 100 },
    { name: 'オレンジ', unit: '1個', price: 100 },
    { name: 'キウイ', unit: '1個', price: 80 },
    { name: '梨', unit: '1個', price: 150 },
    { name: '柿', unit: '1個', price: 100 },
    { name: '桃', unit: '1個', price: 200 },
    { name: 'スイカ（カット）', unit: '1袋', price: 300 },
    { name: 'メロン（カット）', unit: '1袋', price: 300 },
    { name: 'パイナップル', unit: '1個', price: 300 },
    { name: 'さくらんぼ', unit: '1パック', price: 500 },
    { name: 'ブルーベリー', unit: '1パック', price: 350 },
    { name: 'マンゴー', unit: '1個', price: 400 },
    // 米・パン・麺
    { name: '米', unit: '1kg', price: 600 },
    { name: '無洗米', unit: '1kg', price: 650 },
    { name: '玄米', unit: '1kg', price: 550 },
    { name: 'もち米', unit: '1kg', price: 600 },
    { name: '食パン', unit: '1袋', price: 180 },
    { name: 'ロールパン', unit: '1袋', price: 200 },
    { name: 'フランスパン', unit: '1本', price: 250 },
    { name: 'クロワッサン', unit: '1袋', price: 300 },
    { name: 'うどん', unit: '1パック', price: 100 },
    { name: 'そば', unit: '1袋', price: 200 },
    { name: 'パスタ', unit: '1袋', price: 200 },
    { name: '中華麺', unit: '1パック', price: 100 },
    { name: 'ラーメン（生麺）', unit: '1パック', price: 200 },
    { name: '焼きそば麺', unit: '1パック', price: 100 },
    { name: '春雨', unit: '1袋', price: 150 },
    { name: 'ビーフン', unit: '1袋', price: 200 },
    { name: 'マカロニ', unit: '1袋', price: 200 },
    { name: '切り餅', unit: '1袋', price: 300 },
    { name: 'パン粉', unit: '1袋', price: 150 },
    // 豆腐・大豆製品
    { name: '絹豆腐', unit: '1個', price: 50 },
    { name: '木綿豆腐', unit: '1個', price: 50 },
    { name: '焼き豆腐', unit: '1個', price: 100 },
    { name: '厚揚げ', unit: '1個', price: 100 },
    { name: '油揚げ', unit: '1パック', price: 100 },
    { name: 'がんもどき', unit: '1パック', price: 150 },
    { name: '納豆', unit: '1パック', price: 100 },
    { name: 'おから', unit: '1パック', price: 80 },
    { name: '湯葉', unit: '1パック', price: 200 },
    // 調味料
    // mlPerUnit is an approximate typical bottle/jar size in ml — it lets a
    // recipe qty like "大さじ1"/"小さじ1"/"少々" scale down from the whole-
    // container reference price instead of being charged the full price.
    { name: '醤油', unit: '1本', price: 300, mlPerUnit: 1000 },
    { name: '薄口醤油', unit: '1本', price: 300, mlPerUnit: 1000 },
    { name: '味噌', unit: '1個', price: 350, mlPerUnit: 750 },
    { name: '白味噌', unit: '1個', price: 350, mlPerUnit: 750 },
    { name: 'みりん', unit: '1本', price: 300, mlPerUnit: 500 },
    { name: '料理酒', unit: '1本', price: 250, mlPerUnit: 500 },
    { name: '砂糖', unit: '1kg', price: 250 },
    { name: '塩', unit: '1袋', price: 150, mlPerUnit: 300 },
    { name: '胡椒', unit: '1個', price: 250, mlPerUnit: 100 },
    { name: 'サラダ油', unit: '1本', price: 350, mlPerUnit: 600 },
    { name: 'ごま油', unit: '1本', price: 400, mlPerUnit: 300 },
    { name: 'オリーブオイル', unit: '1本', price: 400, mlPerUnit: 400 },
    { name: 'なたね油', unit: '1本', price: 350, mlPerUnit: 600 },
    { name: '酢', unit: '1本', price: 250, mlPerUnit: 500 },
    { name: '米酢', unit: '1本', price: 300, mlPerUnit: 500 },
    { name: 'バルサミコ酢', unit: '1本', price: 500, mlPerUnit: 250 },
    { name: 'マヨネーズ', unit: '1本', price: 300, mlPerUnit: 350 },
    { name: 'ケチャップ', unit: '1本', price: 250, mlPerUnit: 300 },
    { name: 'ウスターソース', unit: '1本', price: 250, mlPerUnit: 300 },
    { name: '中濃ソース', unit: '1本', price: 250, mlPerUnit: 300 },
    { name: 'とんかつソース', unit: '1本', price: 250, mlPerUnit: 300 },
    { name: 'コンソメ', unit: '1個', price: 200, mlPerUnit: 100 },
    { name: '鶏がらスープの素', unit: '1個', price: 250, mlPerUnit: 100 },
    { name: 'カレールー', unit: '1個', price: 250 },
    { name: 'ハヤシルー', unit: '1個', price: 250 },
    { name: 'めんつゆ', unit: '1本', price: 300, mlPerUnit: 500 },
    { name: 'ポン酢', unit: '1本', price: 250, mlPerUnit: 360 },
    { name: 'オイスターソース', unit: '1本', price: 300, mlPerUnit: 300 },
    { name: '豆板醤', unit: '1個', price: 300, mlPerUnit: 100 },
    { name: 'コチュジャン', unit: '1個', price: 300, mlPerUnit: 100 },
    { name: '甜麺醤', unit: '1個', price: 300, mlPerUnit: 100 },
    { name: '練りごま', unit: '1個', price: 300, mlPerUnit: 100 },
    { name: 'すりごま', unit: '1袋', price: 200, mlPerUnit: 100 },
    { name: 'いりごま', unit: '1袋', price: 200, mlPerUnit: 100 },
    { name: 'からし', unit: '1個', price: 200, mlPerUnit: 100 },
    { name: 'わさび', unit: '1個', price: 200, mlPerUnit: 100 },
    { name: '七味唐辛子', unit: '1個', price: 200, mlPerUnit: 60 },
    { name: '一味唐辛子', unit: '1個', price: 200, mlPerUnit: 60 },
    { name: 'カレー粉', unit: '1個', price: 250, mlPerUnit: 100 },
    { name: 'シナモン', unit: '1個', price: 250, mlPerUnit: 60 },
    { name: '片栗粉', unit: '1袋', price: 150 },
    { name: '小麦粉', unit: '1袋', price: 200 },
    { name: '薄力粉', unit: '1袋', price: 200 },
    { name: '強力粉', unit: '1袋', price: 250 },
    { name: 'ホットケーキミックス', unit: '1袋', price: 200 },
    { name: 'ベーキングパウダー', unit: '1個', price: 150, mlPerUnit: 100 },
    { name: '重曹', unit: '1袋', price: 150 },
    { name: 'ゼラチン', unit: '1袋', price: 200 },
    { name: '寒天', unit: '1袋', price: 150 },
    { name: 'はちみつ', unit: '1本', price: 400, mlPerUnit: 300 },
    { name: 'メープルシロップ', unit: '1本', price: 400, mlPerUnit: 200 },
    { name: 'ジャム', unit: '1個', price: 300, mlPerUnit: 300 },
    { name: 'ピーナッツバター', unit: '1個', price: 350, mlPerUnit: 350 },
    { name: 'レモン汁', unit: '1本', price: 200, mlPerUnit: 150 },
    { name: '顆粒だし', unit: '1個', price: 300, mlPerUnit: 100 },
    { name: '白だし', unit: '1本', price: 350, mlPerUnit: 500 },
    { name: '昆布だし', unit: '1個', price: 300 },
    { name: 'かつおだし', unit: '1個', price: 300 },
    { name: '塩昆布', unit: '1袋', price: 300 },
    { name: '梅干し', unit: '1パック', price: 350 },
    { name: '福神漬け', unit: '1パック', price: 200 },
    { name: 'らっきょう', unit: '1パック', price: 250 },
    { name: '紅しょうが', unit: '1パック', price: 150 },
    // 漬物
    { name: 'たくあん', unit: '1パック', price: 200 },
    { name: '浅漬け', unit: '1パック', price: 200 },
    { name: 'キムチ', unit: '1パック', price: 250 },
    { name: 'ザーサイ', unit: '1パック', price: 250 },
    { name: '高菜漬け', unit: '1パック', price: 200 },
    { name: 'ぬか漬け', unit: '1パック', price: 250 },
    // 乾物・缶詰
    { name: '海苔', unit: '1個', price: 300 },
    { name: '焼き海苔', unit: '1個', price: 300 },
    { name: '味付け海苔', unit: '1個', price: 250 },
    { name: 'わかめ', unit: '1袋', price: 200 },
    { name: '昆布', unit: '1袋', price: 300 },
    { name: 'ひじき', unit: '1袋', price: 250 },
    { name: '切り干し大根', unit: '1袋', price: 200 },
    { name: '干し椎茸', unit: '1袋', price: 300 },
    { name: 'くずきり', unit: '1袋', price: 200 },
    { name: 'コーン缶', unit: '1個', price: 150 },
    { name: 'トマト缶', unit: '1個', price: 150 },
    { name: '豆缶', unit: '1個', price: 150 },
    { name: '桃缶', unit: '1個', price: 200 },
    { name: 'みかん缶', unit: '1個', price: 200 },
    // 冷凍食品
    { name: '冷凍餃子', unit: '1袋', price: 300 },
    { name: '冷凍うどん', unit: '1袋', price: 200 },
    { name: '冷凍いちご', unit: '1袋', price: 300 },
    { name: '冷凍ブロッコリー', unit: '1袋', price: 250 },
    { name: '冷凍ほうれん草', unit: '1袋', price: 250 },
    { name: '冷凍えび', unit: '1袋', price: 400 },
    { name: '冷凍から揚げ', unit: '1袋', price: 400 },
    { name: '冷凍ピラフ', unit: '1袋', price: 300 },
    { name: '冷凍枝豆', unit: '1袋', price: 250 },
    { name: '冷凍ミックスベジタブル', unit: '1袋', price: 200 },
    // お菓子
    { name: 'ポテトチップス', unit: '1袋', price: 150 },
    { name: 'チョコレート', unit: '1個', price: 150 },
    { name: 'クッキー', unit: '1袋', price: 200 },
    { name: 'せんべい', unit: '1袋', price: 200 },
    { name: 'グミ', unit: '1袋', price: 150 },
    { name: 'ガム', unit: '1個', price: 100 },
    { name: 'アイスバー', unit: '1本', price: 100 },
    // 飲料
    { name: 'お茶（ペットボトル）', unit: '1本', price: 150 },
    { name: '緑茶（茶葉）', unit: '1袋', price: 400 },
    { name: '麦茶（パック）', unit: '1袋', price: 300 },
    { name: 'コーヒー（豆・粉）', unit: '1袋', price: 500 },
    { name: '紅茶（ティーバッグ）', unit: '1袋', price: 300 },
    { name: 'オレンジジュース', unit: '1本', price: 200 },
    { name: 'りんごジュース', unit: '1本', price: 200 },
    { name: '炭酸水', unit: '1本', price: 100 },
    { name: 'ビール', unit: '1本', price: 220 },
    { name: '日本酒', unit: '1本', price: 800 },
    { name: '焼酎', unit: '1本', price: 900 },
    { name: 'ワイン', unit: '1本', price: 800 },
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

  // "半" (half) or a "n/m" fraction or a plain decimal, as used in spoon/cup
  // measures like "大さじ1/2" or "小さじ半".
  function parseFraction(token) {
    if (token === '半') return 0.5;
    if (token.includes('/')) {
      const [n, d] = token.split('/').map(Number);
      return d ? n / d : 1;
    }
    const n = parseFloat(token);
    return Number.isFinite(n) ? n : 1;
  }

  // Parses a freeform quantity string (e.g. "200g", "1個", "大さじ2",
  // "少々") into a base-unit amount. 大さじ/小さじ/カップ are precise
  // volume measures (15ml/5ml/200ml) regardless of whether the ingredient
  // is a liquid or a powder — that's what the measuring spoon itself is.
  // "少々"/"ひとつまみ"/"適量" are real but deliberately vague amounts,
  // returned as their own 'trace' type rather than guessed as a number.
  // Returns null when it can't confidently parse anything at all.
  function parseQty(qtyStr) {
    if (!qtyStr) return null;
    const s = qtyStr.trim();

    if (/^(少々|ひとつまみ|ひと\s*つまみ|適量|お好みで|適宜)/.test(s)) {
      return { type: 'trace', amount: 1 };
    }

    const numOrFrac = '([0-9]+(?:\\.[0-9]+)?|[0-9]+\\/[0-9]+|半)';
    let m = s.match(new RegExp('^大さじ\\s*' + numOrFrac));
    if (m) return { type: 'volume', amount: parseFraction(m[1]) * 15 };
    m = s.match(new RegExp('^小さじ\\s*' + numOrFrac));
    if (m) return { type: 'volume', amount: parseFraction(m[1]) * 5 };
    m = s.match(new RegExp('^カップ\\s*' + numOrFrac));
    if (m) return { type: 'volume', amount: parseFraction(m[1]) * 200 };

    m = s.match(/^([0-9]+(?:\.[0-9]+)?|[0-9]+\/[0-9]+)\s*(kg|g|l|ml|cc|個|コ|パック|本|袋|枚|玉|片|かけ|束)?/i);
    if (!m) return null;
    const amount = parseFraction(m[1]);
    const unit = (m[2] || '').toLowerCase();
    if (unit === 'kg') return { type: 'weight', amount: amount * 1000 };
    if (unit === 'g') return { type: 'weight', amount };
    if (unit === 'l') return { type: 'volume', amount: amount * 1000 };
    if (unit === 'ml' || unit === 'cc') return { type: 'volume', amount };
    // A piece count. unitWord keeps the original counter word (個/枚/片/…,
    // normalized コ→個) so estimateIngredientCost can tell "3本" of
    // something priced per-本 (an exact match) apart from "5個" of
    // something priced per-パック (individual items out of a package —
    // needs piecesPerUnit to scale down correctly).
    return { type: 'piece', amount, unitWord: m[2] === 'コ' ? '個' : (m[2] || '') };
  }

  // Estimates one ingredient's cost: prefers the user's own cheapest recorded
  // price for that name, falls back to the reference table, then scales by
  // the ingredient's qty. A reference entry's unit (1個/1パック/1袋/1本) is
  // normally a whole retail package, which is the WRONG thing to scale a
  // spoon or a handful of leaves against — charging a full bottle price for
  // "大さじ1" is exactly the bug this guards against. So piece-priced
  // entries only get scaled against a smaller recipe quantity (大さじ/小さじ
  // /ml, or a small 個/枚/片 count) when they carry an explicit mlPerUnit or
  // piecesPerUnit hint describing roughly how much is really in that
  // package. Without a matching hint, or without being able to parse the
  // qty at all, this reports the cost as unknown rather than guess wrong.
  function estimateIngredientCost(ing) {
    const userResults = getComparisonResults(ing.name);
    let source;
    if (userResults.length > 0) {
      source = { price: userResults[0].price, unit: userResults[0].unit, kind: 'user' };
    } else {
      const ref = findReferencePrice(ing.name);
      if (!ref) return { cost: null, source: null, rough: false };
      source = { price: ref.price, unit: ref.unit, kind: 'reference', mlPerUnit: ref.mlPerUnit, piecesPerUnit: ref.piecesPerUnit };
    }

    const rate = unitToRate(source.unit, source.price);
    const qty = parseQty(ing.qty);
    if (!qty) return { cost: null, source: null, rough: false };

    if (qty.type === rate.type) {
      if (rate.type !== 'piece') {
        return { cost: rate.rate * qty.amount, source, rough: false };
      }
      // Both "piece", but that word covers two different things: a count of
      // whole reference packages (qty's counter word matches the source's
      // own unit, e.g. "3本" against a per-本 price) vs a count of
      // individual items out of one package (e.g. "5個" of ミニトマト
      // against a per-パック price). Only the first is safe to multiply
      // directly; the second needs piecesPerUnit to scale down correctly.
      const sourceUnitWord = source.unit.replace(/^1/, '');
      if (qty.unitWord && qty.unitWord === sourceUnitWord) {
        return { cost: rate.rate * qty.amount, source, rough: false };
      }
      if (source.piecesPerUnit) {
        return { cost: (source.price / source.piecesPerUnit) * qty.amount, source, rough: true };
      }
      return { cost: null, source: null, rough: false };
    }
    if (qty.type === 'volume' && rate.type === 'piece' && source.mlPerUnit) {
      return { cost: (source.price / source.mlPerUnit) * qty.amount, source, rough: true };
    }
    if (qty.type === 'trace') {
      if (source.mlPerUnit) return { cost: (source.price / source.mlPerUnit) * 2, source, rough: true };
      if (source.piecesPerUnit) return { cost: (source.price / source.piecesPerUnit) * 0.5, source, rough: true };
    }
    return { cost: null, source: null, rough: false };
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
    if (view === 'settings') renderGeminiKeyStatus();
    if (view === 'recipes') {
      state.currentRecipeId = null;
      document.getElementById('recipeDetailScreen').classList.add('hidden');
      document.getElementById('recipeListScreen').classList.remove('hidden');
      renderRecipeList();
      renderGeminiKeyStatus();
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

  // ---------- Text import (paste a YouTube description etc.) ----------
  // Best-effort pattern matching, not real language understanding: it looks
  // for "材料"/"作り方" style headings and bullet/numbered lines, which is
  // how most recipe descriptions (YouTube, blogs) are actually formatted.
  // Freeform prose without that structure won't parse well — the result
  // always lands on the editable recipe detail screen so mistakes are easy
  // to fix rather than something the user has to trust blindly.

  function toHalfWidthDigits(s) {
    return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  }

  function stripListMarker(line) {
    return line
      .replace(/^[\s]*[・\-*●○◦‣▪]+\s*/, '')
      .replace(/^[\s]*[0-9０-９]+\s*[.)、）]\s*/, '')
      .replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/, '')
      .trim();
  }

  const QTY_TAIL_RE = '(?:[0-9０-９]+(?:\\.[0-9]+)?\\s*(?:kg|g|ml|l|cc|個|コ|パック|本|袋|枚|玉|片|かけ|束|カップ)|大さじ\\s*[0-9０-９/半]+|小さじ\\s*[0-9０-９/半]+|少々|ひとつまみ|適量)';

  function parseIngredientLine(line) {
    if (!line) return null;
    let m = line.match(/^(.+?)[：:]\s*(.+)$/);
    if (m) return { name: m[1].trim(), qty: toHalfWidthDigits(m[2].trim()) };

    m = line.match(/^(.+?)[ \t　]{2,}(.+)$/);
    if (m) return { name: m[1].trim(), qty: toHalfWidthDigits(m[2].trim()) };

    m = line.match(new RegExp('^(.+?)[\\s　]+(' + QTY_TAIL_RE + ')\\s*$', 'i'));
    if (m) return { name: m[1].trim(), qty: toHalfWidthDigits(m[2].trim()) };

    return { name: line, qty: '' };
  }

  function parseRecipeText(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    let name = '';
    let servings = '';
    const ingredients = [];
    const steps = [];
    const groupOrder = [];
    let section = null; // 'ingredients' | 'steps' | null
    let currentGroup = '';
    const servingsRe = /([0-9０-９]+)\s*人分/;

    for (const line of lines) {
      if (!line) continue;

      if (/^(材料|Ingredients?)/i.test(line)) {
        section = 'ingredients';
        currentGroup = '';
        if (!servings) {
          const sm = line.match(servingsRe);
          if (sm) servings = toHalfWidthDigits(sm[0]);
        }
        continue;
      }
      if (/^(作り方|手順|Instructions?|Directions?)/i.test(line)) {
        section = 'steps';
        currentGroup = '';
        continue;
      }

      const groupMatch = section && line.match(/^[【\[](.+?)[】\]]\s*$/);
      if (groupMatch) {
        currentGroup = groupMatch[1].trim();
        if (currentGroup && !groupOrder.includes(currentGroup)) groupOrder.push(currentGroup);
        continue;
      }

      if (!section) {
        if (!name) {
          // Strip a decorative leading tag like "【簡単】" or a standalone
          // bracket around the whole line, so "【簡単】生姜焼き" becomes
          // just "生姜焼き".
          name = stripListMarker(line)
            .replace(/^[【\[][^】\]]*[】\]]\s*/, '')
            .replace(/^[【\[]|[】\]]$/g, '')
            .trim();
        }
        if (!servings) {
          const sm = line.match(servingsRe);
          if (sm) servings = toHalfWidthDigits(sm[0]);
        }
        continue;
      }

      if (section === 'ingredients') {
        const parsed = parseIngredientLine(stripListMarker(line));
        if (parsed && parsed.name) {
          ingredients.push({ id: uid(), name: parsed.name, qty: parsed.qty, group: currentGroup });
        }
        continue;
      }

      if (section === 'steps') {
        const stepText = stripListMarker(line);
        if (stepText) steps.push({ id: uid(), text: stepText, group: currentGroup });
      }
    }

    return { name, servings, ingredients, steps, groupOrder };
  }

  // Calls Gemini (the user's own free-tier API key, stored only on this
  // device) to extract structured recipe data from messy pasted text — much
  // more forgiving than the regex parser, at the cost of sending that text
  // to Google and needing a key. Throws on any failure; the caller falls
  // back to parseRecipeText rather than surfacing this as a hard error.
  async function callGeminiParse(text) {
    const apiKey = getGeminiKey();
    const model = getGeminiModel();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const prompt = [
      'あなたは料理レシピの文章から構造化データを抽出するアシスタントです。',
      '以下はYouTubeの概要欄やレシピサイトなどからコピーされた文章です。',
      'この文章から、レシピ名・人数・材料・手順だけを抽出し、指定されたJSON形式で返してください。',
      '- servings: 「2人分」のような文字列。書かれていなければ空文字。',
      '- ingredients: 各要素は name（材料名）, qty（分量。書かれていなければ空文字）, group（「たれ」「ソース」のように材料が明確にグループ分けされている場合のみそのグループ名、それ以外は空文字）。',
      '- steps: 各要素は text（手順の文章、1手順ごとに分ける）, group（材料と同様に手順がグループ分けされている場合のみ、それ以外は空文字）。',
      '- 挨拶、チャンネル紹介、ハッシュタグ、広告、レシピと無関係な文章は一切含めないこと。',
      '',
      '文章:',
      '"""',
      text,
      '"""',
    ].join('\n');

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            servings: { type: 'string' },
            ingredients: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  qty: { type: 'string' },
                  group: { type: 'string' },
                },
                required: ['name'],
              },
            },
            steps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  text: { type: 'string' },
                  group: { type: 'string' },
                },
                required: ['text'],
              },
            },
          },
          required: ['ingredients', 'steps'],
        },
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error?.message || ''; } catch (e) { /* ignore */ }
      throw new Error(`Gemini API エラー (${res.status})${detail ? ': ' + detail : ''}`);
    }

    const data = await res.json();
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) throw new Error('Geminiからの応答を読み取れませんでした。');
    const parsedJson = JSON.parse(jsonText);

    const groupOrder = [];
    const ingredients = (Array.isArray(parsedJson.ingredients) ? parsedJson.ingredients : [])
      .map((i) => {
        const group = (i.group || '').trim();
        if (group && !groupOrder.includes(group)) groupOrder.push(group);
        return { id: uid(), name: (i.name || '').trim(), qty: (i.qty || '').trim(), group };
      })
      .filter((i) => i.name);
    const steps = (Array.isArray(parsedJson.steps) ? parsedJson.steps : [])
      .map((s) => {
        const group = (s.group || '').trim();
        if (group && !groupOrder.includes(group)) groupOrder.push(group);
        return { id: uid(), text: (s.text || '').trim(), group };
      })
      .filter((s) => s.text);

    return {
      name: (parsedJson.name || '').trim(),
      servings: (parsedJson.servings || '').trim(),
      ingredients,
      steps,
      groupOrder,
    };
  }

  document.getElementById('importRecipeBtn').addEventListener('click', async () => {
    const textEl = document.getElementById('recipeImportText');
    const btn = document.getElementById('importRecipeBtn');
    const text = textEl.value;
    if (!text.trim()) return;

    let parsed = null;
    let usedGemini = false;

    if (getGeminiKey()) {
      const originalLabel = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Geminiで解析中...';
      try {
        parsed = await callGeminiParse(text);
        usedGemini = true;
      } catch (e) {
        console.error('Gemini parse failed, falling back to the regex parser', e);
        showToast('Geminiでの解析に失敗したため、簡易解析にフォールバックしました');
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    }

    if (!parsed || (parsed.ingredients.length === 0 && parsed.steps.length === 0)) {
      parsed = parseRecipeText(text);
      usedGemini = false;
    }

    if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
      alert('材料・手順を読み取れませんでした。「材料」「作り方」などの見出しを含む文章を貼り付けてください。');
      return;
    }

    const recipe = {
      id: uid(),
      name: parsed.name || '新しいレシピ',
      servings: parsed.servings,
      ingredients: parsed.ingredients,
      steps: parsed.steps,
      groupOrder: parsed.groupOrder,
      createdAt: new Date().toISOString(),
    };
    state.data.recipes.push(recipe);
    saveData();
    textEl.value = '';
    document.querySelector('.import-card').removeAttribute('open');
    openRecipeDetail(recipe.id);
    showToast(`${usedGemini ? 'Geminiで' : ''}材料${parsed.ingredients.length}件・手順${parsed.steps.length}件を読み込みました。内容を確認してください。`);
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

  // ---------- Settings: Gemini API key ----------
  function getGeminiKey() {
    try {
      return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
    } catch (e) {
      return '';
    }
  }

  function getGeminiModel() {
    try {
      return localStorage.getItem(GEMINI_MODEL_STORAGE) || DEFAULT_GEMINI_MODEL;
    } catch (e) {
      return DEFAULT_GEMINI_MODEL;
    }
  }

  function renderGeminiKeyStatus() {
    const statusEl = document.getElementById('geminiKeyStatus');
    const aiStatusEl = document.getElementById('importAiStatus');
    const hasKey = !!getGeminiKey();
    statusEl.textContent = hasKey
      ? `保存済み（モデル: ${getGeminiModel()}）。未入力のまま「保存」すると更新されません。`
      : '未設定です。設定すると崩れた文章でも高精度に解析できます。';
    aiStatusEl.textContent = hasKey
      ? 'Geminiで解析します（文章はGoogleに送信されます）。'
      : '簡易的な文章解析を使います（設定タブでGeminiを有効にすると精度が上がります）。';
  }

  document.getElementById('saveGeminiKeyBtn').addEventListener('click', () => {
    const keyEl = document.getElementById('geminiApiKey');
    const modelEl = document.getElementById('geminiModel');
    const key = keyEl.value.trim();
    if (!key) {
      alert('APIキーを入力してください。');
      return;
    }
    try {
      localStorage.setItem(GEMINI_KEY_STORAGE, key);
      localStorage.setItem(GEMINI_MODEL_STORAGE, modelEl.value.trim() || DEFAULT_GEMINI_MODEL);
    } catch (e) {
      alert('保存に失敗しました。');
      return;
    }
    keyEl.value = '';
    modelEl.value = '';
    renderGeminiKeyStatus();
    showToast('Gemini APIキーを保存しました');
  });

  document.getElementById('clearGeminiKeyBtn').addEventListener('click', () => {
    try {
      localStorage.removeItem(GEMINI_KEY_STORAGE);
      localStorage.removeItem(GEMINI_MODEL_STORAGE);
    } catch (e) { /* ignore */ }
    renderGeminiKeyStatus();
    showToast('Gemini APIキーを削除しました');
  });

  // ---------- Init ----------
  renderStoreList();
  renderGeminiKeyStatus();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch((e) => {
        console.error('Service worker registration failed', e);
      });
    });
  }
})();

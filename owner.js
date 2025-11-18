let barangData = [];
let transaksiData = [];
let pengeluaranData = [];
let depositData = [];
let currentKeuanganFilter = 'semua';
let currentStokSource = 'BM1';
let isDataLoaded = false; // Flag untuk track apakah data sudah di-load

function showLoading(show) {
  let loader = document.getElementById('globalLoader');
  if (!loader && show) {
    loader = document.createElement('div');
    loader.id = 'globalLoader';
    loader.innerHTML = '<div class="progress-bar"></div>';
    loader.style.cssText = 'position:fixed;top:0;left:0;right:0;height:3px;background:transparent;z-index:9999;overflow:hidden;';
    document.body.appendChild(loader);
  }  
  if (loader) {
    loader.style.display = show ? 'block' : 'none';
  }
}

// Fungsi tunggal untuk load semua data
async function loadAllData() {
  try {
    if (!isOnline()) {
      alert('❌ Tidak ada koneksi internet. Aplikasi memerlukan koneksi untuk bekerja.');
      return false;
    }
    
    showLoading(true);
    
    const [barang, transaksi, pengeluaran, deposit] = await Promise.all([
      loadBarangData(),
      loadTransaksiData(),
      loadPengeluaranData(),
      loadDepositData()
    ]);
    
    barangData = barang;
    transaksiData = transaksi || [];
    pengeluaranData = pengeluaran;
    depositData = deposit;
    
    isDataLoaded = true;
    return true;
    
  } catch (error) {
    alert('❌ Gagal memuat data dari server. Silakan cek koneksi internet dan refresh halaman.');
    return false;
  } finally {
    showLoading(false);
  }
}

// Fungsi untuk refresh data (optional, jika perlu update data terbaru)
async function refreshData() {
  if (!isOnline()) {
    alert('⚠️ Mode Offline. Data mungkin tidak terbaru.');
    return false;
  }
  
  return await loadAllData();
}

// Fungsi untuk load page - TIDAK load data lagi, hanya render
function loadPageData(page) {
  // Pastikan data sudah di-load dulu
  if (!isDataLoaded) {
    console.warn('Data belum di-load, memanggil loadAllData dulu');
    loadAllData().then(() => {
      renderPage(page);
    });
    return;
  }
  
  renderPage(page);
}

// Fungsi terpisah untuk render page
function renderPage(page) {
  switch(page) {
    case 'dashboard':
      updateDashboard();
      break;
    case 'stok':
      renderStokTable();
      resetStokForm();
      break;
    case 'keuangan':
      initKeuangan();
      renderKeuanganTable();
      break;
    case 'realtime-diagram':
      updateRealtime();      
      if (window.realtimeInterval) {
        clearInterval(window.realtimeInterval);
      }
      window.realtimeInterval = setInterval(() => {
        const currentPage = document.querySelector('.page.active');
        if (currentPage && currentPage.id === 'realtime-diagram') {
          updateRealtime();
        }
      }, 10000);      
      const activePeriod = document.querySelector('#realtime-diagram .btn-filter.active')?.dataset.period || 'daily';
      updateDiagram(activePeriod);
      break;
    case 'pengeluaran':
      renderPengeluaranTables();
      break;
  }
}

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');
  const sidebar = document.querySelector('.sidebar');
  const btnMenu = document.getElementById('btnMenu');
  if (!sidebar || !btnMenu) return;
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = item.dataset.page;      
      if (window.realtimeInterval && targetPage !== 'realtime-diagram') {
        clearInterval(window.realtimeInterval);
        window.realtimeInterval = null;
      }     
      navItems.forEach(nav => nav.classList.remove('active'));
      pages.forEach(page => page.classList.remove('active'));     
      item.classList.add('active');
      const targetElement = document.getElementById(targetPage);
      if (targetElement) {
        targetElement.classList.add('active');
      }      
      const pageTitleEl = document.getElementById('pageTitle');
      if (pageTitleEl) {
        const spanText = item.querySelector('span');
        if (spanText) {
          pageTitleEl.textContent = spanText.textContent;
        }
      }      
      loadPageData(targetPage); // Hanya render, tidak load data lagi
      
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('show');
      }
    });
  });
  
  btnMenu.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    sidebar.classList.toggle('show');
  });
  
  document.addEventListener('click', function(e) {
    if (window.innerWidth > 768) return;
    if (!sidebar.classList.contains('show')) return;   
    const isClickInsideSidebar = sidebar.contains(e.target);
    const isClickOnMenuButton = btnMenu.contains(e.target);
    if (!isClickInsideSidebar && !isClickOnMenuButton) {
      sidebar.classList.remove('show');
    }
  });
}

function updateDashboard() {
  const mainBarangOnly = barangData.filter(b => {
    const jenis = b.jenisTransaksi || 'Penambahan Barang Baru';
    return jenis === 'Penambahan Barang Baru';
  });  
  document.getElementById('totalBarang').textContent = mainBarangOnly.length;  
  const today = getTodayWIB();  
  const todayTransactions = transaksiData.filter(t => {
    const tDate = getLocalDateString(t.tanggal);
    const isToday = tDate === today;
    const isPemasukan = t.jenis === 'Pemasukan';
    const notRefundExchange = !t.tipeProses;    
    return isToday && isPemasukan && notRefundExchange;
  });  
  const todayIncome = todayTransactions.reduce((sum, t) => sum + (t.total || 0), 0);  
  document.getElementById('pemasukanHariIni').textContent = formatRupiah(todayIncome);
  document.getElementById('transaksiHariIni').textContent = todayTransactions.length;  
  const lowStock = mainBarangOnly.filter(b => {
    const banyakItem = b.banyakItemPerTurunan || 1;
    const totalStokBM1 = (b.stokKelompokBM1 * banyakItem) + b.stokTurunanBM1;
    const totalStokBM2 = (b.stokKelompokBM2 * banyakItem) + b.stokTurunanBM2;
    const totalStok = totalStokBM1 + totalStokBM2;
    return totalStok < 20;
  });  
  document.getElementById('stokMenipis').textContent = lowStock.length;  
  renderRecentTransactions();
  renderLowStockAlert(lowStock);
}

function renderRecentTransactions() {
  const container = document.getElementById('recentTransList');
  const recent = transaksiData
    .filter(t => t.jenis === 'Pemasukan' && !t.tipeProses) 
    .slice(-5).reverse();  
  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-message">Belum ada transaksi</p>';
    return;
  }  
  container.innerHTML = recent.map(t => {
    let barangDisplay = t.barang;
    if (barangDisplay && barangDisplay.length > 30) {
      barangDisplay = barangDisplay.substring(0, 30) + '...';
    }    
    return '<div class="trans-item">' +
      '<div class="trans-info">' +
        '<h4>' + (t.nama || 'Transaksi') + '</h4>' +
        '<p>' + formatDateTime(t.waktu) + ' - ' + barangDisplay + '</p>' +
      '</div>' +
      '<div class="trans-amount">' + formatRupiah(t.total) + '</div>' +
    '</div>';
  }).join('');
}

function renderLowStockAlert(lowStock) {
  const container = document.getElementById('lowStockList');  
  if (lowStock.length === 0) {
    container.innerHTML = '<p class="empty-message">Semua stok aman</p>';
    return;
  }  
  container.innerHTML = lowStock.map(b => {
    const banyakItem = b.banyakItemPerTurunan || 1;
    const totalStokBM1 = (b.stokKelompokBM1 * banyakItem) + b.stokTurunanBM1;
    const totalStokBM2 = (b.stokKelompokBM2 * banyakItem) + b.stokTurunanBM2;
    const totalStok = totalStokBM1 + totalStokBM2;    
    return '<div class="stock-item">' +
      '<div class="stock-info">' +
        '<h4>' + b.nama + '</h4>' +
        '<p>ID: ' + b.id + '</p>' +
      '</div>' +
      '<div class="stock-alert">' + totalStok + ' item</div>' +
    '</div>';
  }).join('');
}

let stokMode = 'new';

function initStokManagement() {
  const tabButtons = document.querySelectorAll('.tab-stok-btn');
  const searchInput = document.getElementById('searchBarangStok');
  const btnSearch = document.getElementById('btnSearchStok');
  const form = document.getElementById('formStokInput');
  const idInput = document.getElementById('stokIdBarang');  
  const btnTambahBaru = document.getElementById('btnTambahBarangBaru');
  const btnTambahStok = document.getElementById('btnTambahStok');  
  if (btnTambahBaru) {
    btnTambahBaru.addEventListener('click', () => {
      stokMode = 'new';
      resetStokForm();
      document.getElementById('stokModeIndicator').textContent = 'Mode: Tambah Barang Baru';
      document.getElementById('stokModeIndicator').className = 'mode-indicator mode-new';
      btnTambahBaru.classList.add('active');
      btnTambahStok.classList.remove('active');
    });
  }  
  if (btnTambahStok) {
    btnTambahStok.addEventListener('click', () => {
      stokMode = 'add';
      resetStokForm();
      document.getElementById('stokModeIndicator').textContent = 'Mode: Tambah Stok Barang Lama';
      document.getElementById('stokModeIndicator').className = 'mode-indicator mode-add';
      btnTambahBaru.classList.remove('active');
      btnTambahStok.classList.add('active');      
      searchInput.focus();
    });
  }  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');      
      currentStokSource = btn.dataset.source;
      document.getElementById('currentStokSourceInput').value = currentStokSource;
      document.getElementById('currentStokSource').textContent = currentStokSource === 'BM1' ? 'UD.BM 1' : 'UD.BM 2';
      document.getElementById('tableStokSource').textContent = currentStokSource === 'BM1' ? 'UD.BM 1' : 'UD.BM 2';
      document.getElementById('labelStokKelompok').textContent = currentStokSource === 'BM1' ? 'UD.BM 1' : 'UD.BM 2';      
      resetStokForm();
      renderStokTable();
    });
  });  
  initKelompokButtons();
  
  function performSearchStok() {
    const query = searchInput.value.toLowerCase().trim();
    const barang = barangData.find(b => b.id.toLowerCase() === query || b.nama.toLowerCase().includes(query));    
    if (barang) {
      if (stokMode === 'add') {
        fillStokFormForAddStock(barang);
      } else {
        fillStokForm(barang);
        document.getElementById('stokIsNew').value = 'false';
        document.getElementById('idStokAlert').style.display = 'block';
        document.getElementById('stokButtonText').textContent = 'Update Stok & Harga';
      }
    } else {
      if (stokMode === 'add') {
        alert('Barang tidak ditemukan! Silakan cari dengan ID atau nama yang benar.');
      } else {
        resetStokForm();
        if (query && !isNaN(query)) {
          idInput.value = query;
        }
      }
    }
    renderStokTable();
  }  
  if (btnSearch) {
    btnSearch.addEventListener('click', performSearchStok);
  }  
  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        performSearchStok();
      }
    });
  }
  if (idInput) {
    idInput.addEventListener('input', () => {
      if (stokMode === 'add') return;      
      const id = idInput.value.trim();
      
      // Cari barang dengan exact match
      const barang = barangData.find(b => b.id === id);
      
      if (barang) {
        // Barang ditemukan - isi form
        document.getElementById('stokIsNew').value = 'false';
        document.getElementById('idStokAlert').style.display = 'block';
        document.getElementById('stokButtonText').textContent = 'Update Stok & Harga';
        fillStokForm(barang);
      } else {
        // Barang tidak ditemukan - reset form kecuali ID yang sedang diketik
        document.getElementById('stokIsNew').value = 'true';
        document.getElementById('idStokAlert').style.display = 'none';
        document.getElementById('stokButtonText').textContent = 'Tambah Barang';
        document.getElementById('stokIndex').value = '';
        
        // Reset field lain tapi pertahankan ID yang sedang diketik
        document.getElementById('stokNamaBarang').value = '';
        document.getElementById('stokHargaModal').value = 0;
        document.getElementById('stokHargaKelompok').value = 0;
        document.getElementById('stokHargaTurunan').value = 0;
        document.getElementById('stokJumlahKelompok').value = 0;
        document.getElementById('stokJumlahTurunan').value = 0;
        
        // Reset ke satuan default
        const buttons = document.querySelectorAll('.btn-kelompok');
        buttons.forEach(b => b.classList.remove('active'));
        const defaultBtn = document.querySelector('.btn-kelompok[data-kelompok="satuan"]');
        if (defaultBtn) defaultBtn.click();
      }
    });
  }  
  if (form) {
    form.addEventListener('submit', handleStokFormSubmit);
  }  
  const btnReset = document.getElementById('btnResetStok');
  if (btnReset) {
    btnReset.addEventListener('click', resetStokForm);
  }  
  const hargaKelompokInput = document.getElementById('stokHargaKelompok');
  const banyakItemInput = document.getElementById('stokBanyakItem');  
  if (hargaKelompokInput) {
    hargaKelompokInput.addEventListener('input', calculateHargaTurunan);
  }  
  if (banyakItemInput) {
    banyakItemInput.addEventListener('input', calculateHargaTurunan);
  }
}

function fillStokFormForAddStock(barang) {
  document.getElementById('stokIdBarang').value = barang.id;
  document.getElementById('stokIdBarang').readOnly = true;  
  document.getElementById('stokNamaBarang').value = barang.nama;
  document.getElementById('stokNamaBarang').readOnly = true;  
  const jenisKelompok = barang.jenisKelompok || 'Satuan';
  document.getElementById('stokJenisKelompok').value = jenisKelompok;  
  document.querySelectorAll('.btn-kelompok').forEach(btn => {
    btn.disabled = true;
    btn.classList.remove('active');
    if (btn.dataset.kelompok === jenisKelompok.toLowerCase()) {
      btn.classList.add('active');
    }
  });  
  document.getElementById('stokBanyakItem').value = barang.banyakItemPerTurunan || 1;
  document.getElementById('stokBanyakItem').readOnly = true;  
  document.getElementById('stokHargaModal').value = 0;
  document.getElementById('stokHargaKelompok').value = 0;
  document.getElementById('stokHargaTurunan').value = 0;  
  document.getElementById('stokJumlahKelompok').value = 0;
  document.getElementById('stokJumlahTurunan').value = 0;  
  document.getElementById('stokIsNew').value = 'false';
  document.getElementById('stokIndex').value = barangData.findIndex(b => b.id === barang.id);
  document.getElementById('stokButtonText').textContent = 'Tambah Stok Barang';  
  const stokLama = currentStokSource === 'BM1' 
    ? ((barang.stokKelompokBM1 || 0) * (barang.banyakItemPerTurunan || 1)) + (barang.stokTurunanBM1 || 0)
    : ((barang.stokKelompokBM2 || 0) * (barang.banyakItemPerTurunan || 1)) + (barang.stokTurunanBM2 || 0);  
  const stokInfo = document.getElementById('stokLamaInfo');
  if (stokInfo) {
    stokInfo.textContent = 'Stok lama di ' + (currentStokSource === 'BM1' ? 'UD.BM 1' : 'UD.BM 2') + ': ' + stokLama + ' item';
    stokInfo.style.display = 'block';
  }  
  const activeBtn = document.querySelector('.btn-kelompok[data-kelompok="' + jenisKelompok.toLowerCase() + '"]');
  if (activeBtn) {
    const groupBanyakItem = document.getElementById('groupBanyakItem');
    const groupTurunan = document.getElementById('groupTurunan');
    const groupStokTurunan = document.getElementById('groupStokTurunan');    
    if (jenisKelompok.toLowerCase() !== 'satuan') {
      groupBanyakItem.style.display = 'block';
      groupTurunan.style.display = 'block';
      groupStokTurunan.style.display = 'block';
    }
  }
}

function initKelompokButtons() {
  const buttons = document.querySelectorAll('.btn-kelompok');
  const kelompokInput = document.getElementById('stokJenisKelompok');
  const groupBanyakItem = document.getElementById('groupBanyakItem');
  const groupTurunan = document.getElementById('groupTurunan');
  const groupStokTurunan = document.getElementById('groupStokTurunan');
  const banyakItemInput = document.getElementById('stokBanyakItem');  
  const labelBanyakItem = document.getElementById('labelBanyakItem');
  const labelModalKelompok = document.getElementById('labelModalKelompok');
  const labelJualKelompok = document.getElementById('labelJualKelompok');
  const labelTurunan = document.getElementById('labelTurunan');
  const labelStokTurunan = document.getElementById('labelStokTurunan');
  const infoTurunan = document.getElementById('infoTurunan');  
  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      buttons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');      
      const kelompok = this.dataset.kelompok;
      if (kelompokInput) kelompokInput.value = kelompok;      
      groupBanyakItem.style.display = 'none';
      groupTurunan.style.display = 'none';
      groupStokTurunan.style.display = 'none';
      banyakItemInput.value = 1;
      banyakItemInput.readOnly = false;      
      switch(kelompok) {
        case 'satuan':
          labelModalKelompok.textContent = 'Modal Satuan';
          labelJualKelompok.textContent = 'Harga Jual Satuan';
          break;          
        case 'kotak':
          labelModalKelompok.textContent = 'Modal Kotak';
          labelJualKelompok.textContent = 'Harga Jual Kotak';
          labelBanyakItem.textContent = 'Isi Per Kotak (satuan)';
          labelTurunan.textContent = 'Harga Jual Per Satuan';
          labelStokTurunan.textContent = 'Satuan';
          infoTurunan.textContent = 'Harga per satuan (otomatis dihitung dari harga kotak ÷ isi per kotak)';
          groupBanyakItem.style.display = 'block';
          groupTurunan.style.display = 'block';
          groupStokTurunan.style.display = 'block';
          break;          
        case 'kodi':
          labelModalKelompok.textContent = 'Modal Kodi';
          labelJualKelompok.textContent = 'Harga Jual Kodi';
          labelBanyakItem.textContent = 'Isi Per Kodi';
          labelTurunan.textContent = 'Harga Jual Per Satuan';
          labelStokTurunan.textContent = 'Satuan';
          infoTurunan.textContent = '1 Kodi = 20 satuan (tetap)';
          banyakItemInput.value = 20;
          banyakItemInput.readOnly = true;
          groupBanyakItem.style.display = 'block';
          groupTurunan.style.display = 'block';
          groupStokTurunan.style.display = 'block';
          break;          
        case 'meter':
          labelModalKelompok.textContent = 'Modal Meter';
          labelJualKelompok.textContent = 'Harga Jual Meter';
          labelBanyakItem.textContent = 'Isi Per Meter';
          labelTurunan.textContent = 'Harga Jual Per Sentimeter';
          labelStokTurunan.textContent = 'Sentimeter';
          infoTurunan.textContent = '1 Meter = 100 sentimeter (tetap)';
          banyakItemInput.value = 100;
          banyakItemInput.readOnly = true;
          groupBanyakItem.style.display = 'block';
          groupTurunan.style.display = 'block';
          groupStokTurunan.style.display = 'block';
          break;          
        case 'kilogram':
          labelModalKelompok.textContent = 'Modal Kilogram';
          labelJualKelompok.textContent = 'Harga Jual Kilogram';
          labelBanyakItem.textContent = 'Isi Per Kilogram';
          labelTurunan.textContent = 'Harga Jual Per Gram';
          labelStokTurunan.textContent = 'Gram';
          infoTurunan.textContent = '1 Kilogram = 1000 gram (tetap)';
          banyakItemInput.value = 1000;
          banyakItemInput.readOnly = true;
          groupBanyakItem.style.display = 'block';
          groupTurunan.style.display = 'block';
          groupStokTurunan.style.display = 'block';
          break;          
        case 'keping':
          labelModalKelompok.textContent = 'Modal Keping';
          labelJualKelompok.textContent = 'Harga Jual Keping';
          break;
      }      
      calculateHargaTurunan();
    });
  });  
  const defaultBtn = document.querySelector('.btn-kelompok[data-kelompok="satuan"]');
  if (defaultBtn) defaultBtn.classList.add('active');
}

function calculateHargaTurunan() {
  const kelompok = document.getElementById('stokJenisKelompok').value;
  const hargaKelompok = parseFloat(document.getElementById('stokHargaKelompok').value) || 0;
  const banyakItem = parseFloat(document.getElementById('stokBanyakItem').value) || 1;
  const hargaTurunanInput = document.getElementById('stokHargaTurunan');  
  if (kelompok !== 'satuan' && banyakItem > 0) {
    const hargaTurunan = Math.round(hargaKelompok / banyakItem);
    hargaTurunanInput.value = hargaTurunan;
  } else {
    hargaTurunanInput.value = 0;
  }
}

function fillStokForm(barang) {
  const index = barangData.findIndex(b => b.id === barang.id);
  document.getElementById('stokIndex').value = index;
  document.getElementById('stokIdBarang').value = barang.id;
  document.getElementById('stokNamaBarang').value = barang.nama;
  document.getElementById('stokHargaModal').value = barang.modalBarang || 0;
  document.getElementById('stokHargaKelompok').value = barang.hargaJualKelompok || 0;
  document.getElementById('stokHargaTurunan').value = barang.hargaJualTurunan || 0;  
  if (currentStokSource === 'BM1') {
    document.getElementById('stokJumlahKelompok').value = barang.stokKelompokBM1 || 0;
    document.getElementById('stokJumlahTurunan').value = barang.stokTurunanBM1 || 0;
  } else {
    document.getElementById('stokJumlahKelompok').value = barang.stokKelompokBM2 || 0;
    document.getElementById('stokJumlahTurunan').value = barang.stokTurunanBM2 || 0;
  }  
  const jenisKelompok = barang.jenisKelompok || 'Satuan';
  document.getElementById('stokJenisKelompok').value = jenisKelompok;  
  const banyakItem = barang.banyakItemPerTurunan || 1;
  document.getElementById('stokBanyakItem').value = banyakItem;  
  const buttons = document.querySelectorAll('.btn-kelompok');
  buttons.forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector('.btn-kelompok[data-kelompok="' + jenisKelompok.toLowerCase() + '"]');
  if (activeBtn) {
    activeBtn.click();
  }
}

function resetStokForm() {
  const form = document.getElementById('formStokInput');
  if (form) form.reset();  
  document.getElementById('stokIsNew').value = 'true';
  document.getElementById('stokIndex').value = '';
  document.getElementById('idStokAlert').style.display = 'none';
  document.getElementById('stokButtonText').textContent = stokMode === 'add' ? 'Tambah Stok Barang' : 'Tambah Barang';
  document.getElementById('currentStokSourceInput').value = currentStokSource;  
  document.getElementById('stokJumlahKelompok').value = 0;
  document.getElementById('stokJumlahTurunan').value = 0;  
  document.getElementById('stokHargaModal').value = 0;
  document.getElementById('stokHargaKelompok').value = 0;
  document.getElementById('stokHargaTurunan').value = 0;
  document.getElementById('stokIdBarang').value = '';
  document.getElementById('stokIdBarang').readOnly = false;
  document.getElementById('stokNamaBarang').readOnly = false;
  document.getElementById('stokBanyakItem').value = 1;
  document.getElementById('stokBanyakItem').readOnly = false;  
  const searchInput = document.getElementById('searchBarangStok');
  if (searchInput) searchInput.value = '';  
  const stokInfo = document.getElementById('stokLamaInfo');
  if (stokInfo) stokInfo.style.display = 'none';  
  const buttons = document.querySelectorAll('.btn-kelompok');
  buttons.forEach(b => {
    b.classList.remove('active');
    b.disabled = false;
  });
  const defaultBtn = document.querySelector('.btn-kelompok[data-kelompok="satuan"]');
  if (defaultBtn) defaultBtn.click();
}

async function handleStokFormSubmit(e) {
  e.preventDefault();  
  if (!isOnline()) {
    alert('❌ Tidak ada koneksi internet. Simpan data memerlukan koneksi online.');
    return;
  }  
  const isNew = document.getElementById('stokIsNew').value === 'true';
  const idBarang = document.getElementById('stokIdBarang').value.trim();
  const source = document.getElementById('currentStokSourceInput').value;  
  if (!idBarang || !document.getElementById('stokNamaBarang').value) {
    alert('ID dan Nama Barang wajib diisi!');
    return;
  }
  const jenisKelompok = document.getElementById('stokJenisKelompok').value;
  const banyakItemPerTurunan = parseInt(document.getElementById('stokBanyakItem').value) || 1;
  const modalBarang = parseFloat(document.getElementById('stokHargaModal').value) || 0;
  const hargaJualKelompok = parseFloat(document.getElementById('stokHargaKelompok').value) || 0;
  const hargaJualTurunan = parseFloat(document.getElementById('stokHargaTurunan').value) || 0;
  const stokKelompokInput = parseInt(document.getElementById('stokJumlahKelompok').value) || 0;
  const stokTurunanInput = parseInt(document.getElementById('stokJumlahTurunan').value) || 0;
  let newBarangData;
  let isStokAddition = false;
  let oldTotalStok = 0;  
  
  if (stokMode === 'add') {
    const existingBarang = barangData.find(b => b.id === idBarang && b.jenisTransaksi === 'Penambahan Barang Baru');
    if (!existingBarang) {
      alert('Barang tidak ditemukan!');
      return;
    }    
    if (stokKelompokInput === 0 && stokTurunanInput === 0) {
      alert('❌ Jumlah stok yang ditambahkan tidak boleh kosong!');
      return;
    }    
    if (modalBarang === 0 || hargaJualKelompok === 0) {
      alert('Modal dan Harga Jual wajib diisi untuk penambahan stok!');
      return;
    }    
    
    // Hitung total stok lama dari SEMUA BATCH (utama + history sebelumnya)
    oldTotalStok = calculateTotalStokForBarang(idBarang, barangData, source);
    
    const totalStokTambah = (stokKelompokInput * banyakItemPerTurunan) + stokTurunanInput;
    const newTotalStok = oldTotalStok + totalStokTambah;
    
    // ✅ Simpan history stok baru
    const historyBarang = {
      tanggal: getTodayWIB(),
      id: idBarang,
      nama: existingBarang.nama,
      jenisKelompok: jenisKelompok,
      banyakItemPerTurunan: banyakItemPerTurunan,
      jenisTurunan: getSatuanTurunanLabel(jenisKelompok).toLowerCase(),      
      stokKelompokBM1: source === 'BM1' ? stokKelompokInput : 0,
      stokKelompokBM2: source === 'BM2' ? stokKelompokInput : 0,      
      stokTurunanBM1: source === 'BM1' ? stokTurunanInput : 0,
      stokTurunanBM2: source === 'BM2' ? stokTurunanInput : 0,      
      modalBarang: modalBarang,
      hargaJualKelompok: hargaJualKelompok,
      hargaJualTurunan: hargaJualTurunan,      
      totalItem: totalStokTambah, // Hanya stok batch ini
      totalItemTerjual: 0,
      totalHargaItemTerjual: 0,
      totalModal: 0,
      keuntunganMargin: 0,      
      jenisTransaksi: 'Penambahan Stok Lama',
      alamat: source === 'BM1' ? 'UD.BM 1' : 'UD.BM 2',
      status: 'Tambah Stok',
      catatan: `Stok Lama: ${oldTotalStok} → Ditambah: +${totalStokTambah} → Stok Baru: ${newTotalStok} ${getSatuanTurunanLabel(jenisKelompok)} | Modal: ${formatRupiah(modalBarang)}, Harga Jual: ${formatRupiah(hargaJualKelompok)}${hargaJualTurunan > 0 ? ', Turunan: ' + formatRupiah(hargaJualTurunan) : ''}`
    };
    
    // ✅ CRITICAL FIX: Update main HANYA Total Item, JANGAN ubah stok kelompok
    const updatedMainBarang = {
      tanggal: existingBarang.tanggal || getTodayWIB(),
      id: existingBarang.id,
      nama: existingBarang.nama,
      jenisKelompok: existingBarang.jenisKelompok,
      banyakItemPerTurunan: existingBarang.banyakItemPerTurunan,
      jenisTurunan: existingBarang.jenisTurunan,
      
      // ✅ TETAP gunakan stok LAMA (jangan update dari input)
      stokKelompokBM1: existingBarang.stokKelompokBM1 || 0,
      stokKelompokBM2: existingBarang.stokKelompokBM2 || 0,
      stokTurunanBM1: existingBarang.stokTurunanBM1 || 0,
      stokTurunanBM2: existingBarang.stokTurunanBM2 || 0,
      
      // ✅ TETAP gunakan harga LAMA
      modalBarang: existingBarang.modalBarang,
      hargaJualKelompok: existingBarang.hargaJualKelompok,
      hargaJualTurunan: existingBarang.hargaJualTurunan,
      
      // ✅ UPDATE hanya Total Item (agregat semua batch)
      totalItem: newTotalStok,
      
      // ✅ TETAP gunakan statistik penjualan yang sudah ada
      totalItemTerjual: existingBarang.totalItemTerjual || 0,
      totalHargaItemTerjual: existingBarang.totalHargaItemTerjual || 0,
      totalModal: existingBarang.totalModal || 0,
      keuntunganMargin: existingBarang.keuntunganMargin || 0,
      
      jenisTransaksi: 'Penambahan Barang Baru',
      alamat: existingBarang.alamat || '-',
      status: existingBarang.status || 'Tambah Barang Baru',
      catatan: existingBarang.catatan || ''
    };
    
    isStokAddition = true;    
    try {
      showLoading(true);      
      
      // ✅ Kirim 2 record: update main (hanya Total Item) + insert history
      await saveBarangData([updatedMainBarang, historyBarang]);      
      
      alert(`✅ Stok berhasil ditambahkan!\n\nStok Lama: ${oldTotalStok}\nDitambah: +${totalStokTambah}\nStok Baru: ${newTotalStok}`);      
      
      const [barang] = await Promise.all([loadBarangData()]);
      barangData = barang;      
      renderStokTable();
      resetStokForm();
      updateDashboard();      
    } catch (error) {
      alert('❌ Gagal menyimpan data. Silakan cek koneksi dan coba lagi.');
    } finally {
      showLoading(false);
    }    
    return;
  }  
  
  // ========================================
  // MODE TAMBAH BARANG BARU atau UPDATE
  // ========================================
  if (isNew) {
    if (barangData.some(b => b.id === idBarang)) {
      alert('ID Barang sudah ada. Gunakan tombol update atau reset form.');
      return;
    }    
    if (modalBarang === 0) {
      alert('Modal barang wajib diisi untuk perhitungan laba!');
      return;
    }
    
    const totalStokBaru = (stokKelompokInput * banyakItemPerTurunan) + stokTurunanInput;
    
    newBarangData = {
      id: idBarang,
      nama: document.getElementById('stokNamaBarang').value,
      jenisKelompok: jenisKelompok,
      banyakItemPerTurunan: banyakItemPerTurunan,
      jenisTurunan: getSatuanTurunanLabel(jenisKelompok).toLowerCase(),      
      stokKelompokBM1: source === 'BM1' ? stokKelompokInput : 0,
      stokKelompokBM2: source === 'BM2' ? stokKelompokInput : 0,      
      stokTurunanBM1: source === 'BM1' ? stokTurunanInput : 0,
      stokTurunanBM2: source === 'BM2' ? stokTurunanInput : 0,      
      modalBarang: modalBarang,
      hargaJualKelompok: hargaJualKelompok,
      hargaJualTurunan: hargaJualTurunan,
      totalItem: totalStokBaru,      
      tanggal: getTodayWIB(),      
      jenisTransaksi: 'Penambahan Barang Baru',
      alamat: '-',
      status: 'Tambah Barang Baru',
      catatan: ''
    };    
    barangData.push(newBarangData);    
  } else {
    // MODE UPDATE BARANG UTAMA
    const existingBarangIndex = barangData.findIndex(b => b.id === idBarang);
    if (existingBarangIndex === -1) {
      alert('Barang tidak ditemukan.');
      return;
    }    
    const existingBarang = barangData[existingBarangIndex];
    
    const totalStokUpdate = (stokKelompokInput * banyakItemPerTurunan) + stokTurunanInput;
    
    newBarangData = {
      ...existingBarang,
      nama: document.getElementById('stokNamaBarang').value,
      jenisKelompok: jenisKelompok,
      banyakItemPerTurunan: banyakItemPerTurunan,
      jenisTurunan: getSatuanTurunanLabel(jenisKelompok).toLowerCase(),      
      modalBarang: modalBarang,
      hargaJualKelompok: hargaJualKelompok,
      hargaJualTurunan: hargaJualTurunan,
      totalItem: totalStokUpdate,      
      tanggal: existingBarang.tanggal || getTodayWIB(),      
      jenisTransaksi: existingBarang.jenisTransaksi || 'Penambahan Barang Baru',
      alamat: existingBarang.alamat || '-',
      status: existingBarang.status || 'Tambah Barang Baru',
      catatan: existingBarang.catatan || ''
    };    
    if (source === 'BM1') {
      newBarangData.stokKelompokBM1 = stokKelompokInput;
      newBarangData.stokTurunanBM1 = stokTurunanInput;
      newBarangData.stokKelompokBM2 = existingBarang.stokKelompokBM2 || 0;
      newBarangData.stokTurunanBM2 = existingBarang.stokTurunanBM2 || 0;
    } else {
      newBarangData.stokKelompokBM1 = existingBarang.stokKelompokBM1 || 0;
      newBarangData.stokTurunanBM1 = existingBarang.stokTurunanBM1 || 0;
      newBarangData.stokKelompokBM2 = stokKelompokInput;
      newBarangData.stokTurunanBM2 = stokTurunanInput;
    }    
    barangData[existingBarangIndex] = newBarangData;
  }  
  try {
    showLoading(true);    
    await saveBarangData([newBarangData]);    
    alert(isNew ? '✅ Barang berhasil ditambahkan!' : '✅ Barang berhasil diupdate!');    
    const [barang] = await Promise.all([loadBarangData()]);
    barangData = barang;    
    renderStokTable();
    resetStokForm();
    updateDashboard();    
  } catch (error) {
    alert('❌ Gagal menyimpan data. Silakan cek koneksi dan coba lagi.');
  } finally {
    showLoading(false);
  }
}

// PERBAIKAN: renderStokTable - Tampilkan stok lama dan baru terpisah
function renderStokTable() {
  const tbody = document.getElementById('stokTableBody');  
  if (!tbody) return;  
  if (barangData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-message">Belum ada data barang</td></tr>';
    return;
  }  
  
  // Filter barang utama
  const mainBarangOnly = barangData.filter(b => {
    const jenis = b.jenisTransaksi || 'Penambahan Barang Baru';
    return jenis === 'Penambahan Barang Baru';
  });
  
  if (mainBarangOnly.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-message">Belum ada data barang utama</td></tr>';
    return;
  }  
  
  let html = '';
  
  mainBarangOnly.forEach((item) => {
    const kelompokLabel = getKelompokLabel(item.jenisKelompok || 'Satuan');
    const turunanLabel = item.jenisTurunan || getSatuanTurunanLabel(item.jenisKelompok || 'Satuan');
    const banyakItem = item.banyakItemPerTurunan || 1;
    
    let stokKelompokMain, stokTurunanMain;
    
    if (currentStokSource === 'BM1') {
      stokKelompokMain = item.stokKelompokBM1 || 0;
      stokTurunanMain = item.stokTurunanBM1 || 0;
    } else {
      stokKelompokMain = item.stokKelompokBM2 || 0;
      stokTurunanMain = item.stokTurunanBM2 || 0;
    }    
    
    const totalStokMain = (stokKelompokMain * banyakItem) + stokTurunanMain;
    
    // ✅ TAMPILKAN ROW BARANG UTAMA
    let stokDisplay;
    if (item.jenisKelompok && item.jenisKelompok.toLowerCase() !== 'satuan') {
      stokDisplay = `${stokKelompokMain} ${kelompokLabel}`;
    } else {
      stokDisplay = `${totalStokMain} ${turunanLabel}`;
    }    
    
    html += `<tr class="main-barang-row">
      <td rowspan="1"><strong>${item.id}</strong></td>
      <td>${item.nama}</td>
      <td><span class="kelompok-badge">${kelompokLabel}</span></td>
      <td>${item.banyakItemPerTurunan}</td>
      <td>${formatRupiah(item.hargaJualKelompok)}</td>
      <td>${turunanLabel}</td>
      <td>${formatRupiah(item.hargaJualTurunan)}</td>
      <td>${stokDisplay}</td>
      <td>${stokTurunanMain} ${turunanLabel}</td>
      <td><strong>${totalStokMain} ${turunanLabel}</strong></td>
      <td>
        <button class="btn-edit" onclick="editBarangStok('${item.id}')">
          <i class="fas fa-edit"></i> Edit
        </button>
        <button class="btn-delete" onclick="deleteBarangStok('${item.id}')">
          <i class="fas fa-trash"></i> Hapus
        </button>
      </td>
    </tr>`;
    
    // ✅ CARI HISTORY STOK LAMA untuk barang ini
    const stokLamaHistory = barangData.filter(b => 
      b.id === item.id && 
      b.jenisTransaksi === 'Penambahan Stok Lama'
    ).sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal)); // Urutkan dari lama ke baru
    
    if (stokLamaHistory.length > 0) {
      html += `<tr class="section-subheader">
        <td colspan="11" style="background: #eff6ff; font-weight: 600; padding: 8px; font-size: 12px;">
          <i class="fas fa-layer-group"></i> Riwayat Penambahan Stok
        </td>
      </tr>`;
      
      stokLamaHistory.forEach((history, idx) => {
        let stokKelompokHistory, stokTurunanHistory;
        
        if (currentStokSource === 'BM1') {
          stokKelompokHistory = history.stokKelompokBM1 || 0;
          stokTurunanHistory = history.stokTurunanBM1 || 0;
        } else {
          stokKelompokHistory = history.stokKelompokBM2 || 0;
          stokTurunanHistory = history.stokTurunanBM2 || 0;
        }
        
        const totalStokHistory = (stokKelompokHistory * banyakItem) + stokTurunanHistory;
        
        let stokDisplayHistory;
        if (item.jenisKelompok && item.jenisKelompok.toLowerCase() !== 'satuan') {
          stokDisplayHistory = `${stokKelompokHistory} ${kelompokLabel}`;
        } else {
          stokDisplayHistory = `${totalStokHistory} ${turunanLabel}`;
        }
        
        html += `<tr class="stok-lama-row">
          <td style="padding-left: 30px; font-size: 11px; color: #64748b;">
            <i class="fas fa-arrow-right"></i> ${formatDate(history.tanggal)}
          </td>
          <td style="font-size: 11px; color: #64748b;">Stok Tambahan #${idx + 1}</td>
          <td><span class="kelompok-badge" style="background: #f59e0b;">${kelompokLabel}</span></td>
          <td>${history.banyakItemPerTurunan}</td>
          <td>${formatRupiah(history.hargaJualKelompok)}</td>
          <td>${turunanLabel}</td>
          <td>${formatRupiah(history.hargaJualTurunan)}</td>
          <td>${stokDisplayHistory}</td>
          <td>${stokTurunanHistory} ${turunanLabel}</td>
          <td><strong>${totalStokHistory} ${turunanLabel}</strong></td>
          <td style="font-size: 11px; color: #64748b;">${history.catatan || '-'}</td>
        </tr>`;
      });
      
      // Separator
      html += `<tr style="height: 10px;"><td colspan="11" style="background: #f8fafc;"></td></tr>`;
    }
  });
  
  tbody.innerHTML = html;
}

window.viewCustomerDepositDetail = async function(customerName) {
  const customerTransactions = depositData.filter(d => 
    d.nama.toLowerCase() === customerName.toLowerCase()
  ).sort((a, b) => new Date(a.waktu) - new Date(b.waktu));
  
  if (customerTransactions.length === 0) {
    alert('❌ Tidak ada data deposit untuk pelanggan ini.');
    return;
  }
  
  const latestBalance = customerTransactions[customerTransactions.length - 1].saldo;
  
  let detailHTML = `
    <h3>Detail Deposit: ${customerName}</h3>
    <p><strong>Saldo Terakhir: ${formatRupiah(latestBalance)}</strong></p>
    <table border="1" cellpadding="8" cellspacing="0" style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f3f4f6;">
          <th>Waktu</th>
          <th>Jenis</th>
          <th>Jumlah</th>
          <th>Saldo</th>
          <th>Keterangan</th>
          <th>Toko</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  customerTransactions.forEach(t => {
    const jenisColor = t.jenis === 'Deposit' ? '#10b981' : '#f59e0b';
    detailHTML += `
      <tr>
        <td>${formatDateTime(t.waktu)}</td>
        <td><span style="color: ${jenisColor}; font-weight: bold;">${t.jenis}</span></td>
        <td>${formatRupiah(Math.abs(t.jumlah))}</td>
        <td><strong>${formatRupiah(t.saldo)}</strong></td>
        <td>${t.keterangan || '-'}</td>
        <td>${t.toko || '-'}</td>
      </tr>
    `;
  });
  
  detailHTML += `
      </tbody>
    </table>
  `;
  
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('❌ Popup diblokir! Silakan izinkan popup untuk melihat detail.');
    return;
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Detail Deposit - ${customerName}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h3 { color: #1e293b; }
        table { margin-top: 20px; }
        th { background: #f3f4f6; text-align: left; }
        td, th { padding: 8px; border: 1px solid #e2e8f0; }
        @media print {
          button { display: none; }
        }
      </style>
    </head>
    <body>
      ${detailHTML}
      <br>
      <button onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Cetak
      </button>
      <button onclick="window.close()" style="padding: 10px 20px; background: #64748b; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
        Tutup
      </button>
    </body>
    </html>
  `);
  
  printWindow.document.close();
};

window.editBarangStok = function(itemId) {
  const barang = barangData.find(b => b.id === itemId);
  if (barang) {
    fillStokForm(barang);
    document.getElementById('stokIsNew').value = 'false';
    document.getElementById('idStokAlert').style.display = 'block';
    document.getElementById('stokButtonText').textContent = 'Update Stok & Harga';
    document.getElementById('searchBarangStok').value = itemId;
    document.getElementById('stok').scrollIntoView({ behavior: 'smooth' });
  }
};

window.deleteBarangStok = async function(index) {
  if (!isOnline()) {
    alert('❌ Tidak ada koneksi internet. Hapus data memerlukan koneksi online.');
    return;
  }  
  if (confirm('Yakin ingin menghapus barang ini? Tindakan ini tidak dapat dibatalkan!')) {
    const idToDelete = barangData[index].id;    
    try {
      showLoading(true);      
      await deleteBarangById(idToDelete);      
      barangData.splice(index, 1);      
      renderStokTable();
      alert('✅ Barang berhasil dihapus!');
      updateDashboard();      
    } catch (error) {
      alert('❌ Gagal menghapus data. Silakan coba lagi.');
    } finally {
      showLoading(false);
    }
  }
};

function calculateGrossProfit(transaction) {
  if (transaction.jenis !== 'Pemasukan' || !transaction.items || !Array.isArray(transaction.items)) {
    return 0;
  }  
  if (!barangData || barangData.length === 0) {
    return 0;
  }  
  let totalModal = 0;  
  transaction.items.forEach(item => {
    if (item.hargaModalUnit && item.hargaModalUnit > 0) {
      totalModal += item.hargaModalUnit * item.qty;
      return;
    }    
    const barang = barangData.find(b => b.id === item.id);    
    if (!barang) {
      const estimatedModal = item.harga * 0.7;
      totalModal += estimatedModal * item.qty;
      return;
    }    
    const banyakItem = barang.banyakItemPerTurunan || 1;
    const modalBarang = barang.modalBarang || 0;    
    let modalUnit;
    if (item.typeBarang === 'kelompok') {
      modalUnit = modalBarang;
    } else {
      modalUnit = banyakItem > 0 ? modalBarang / banyakItem : modalBarang;
    }    
    totalModal += (modalUnit || 0) * item.qty;
  });  
  return transaction.total - totalModal;
}

function initKeuangan() {
  const filterBulan = document.getElementById('filterBulan');
  const filterTahun = document.getElementById('filterTahun');
  const btnPrintKeuangan = document.getElementById('btnPrintKeuangan');  
  
  if (!filterBulan || !filterTahun) return;  
  
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');  
  
  if (filterTahun.options.length === 0) {
    for (let i = currentYear; i >= currentYear - 5; i--) {
      const option = document.createElement('option');
      option.value = i;
      option.textContent = i;
      filterTahun.appendChild(option);
    }
  }
  
  filterTahun.value = currentYear;
  filterBulan.value = currentMonth;
  filterBulan.onchange = renderKeuanganTable;
  filterTahun.onchange = renderKeuanganTable;  
  
  if (btnPrintKeuangan) {
    btnPrintKeuangan.onclick = printKeuanganTable;
  }  
  
  const btnFilterSemua = document.getElementById('btnFilterSemua');
  const btnFilterTransaksi = document.getElementById('btnFilterTransaksi');
  const btnFilterPengeluaran = document.getElementById('btnFilterPengeluaran');
  const btnFilterBarang = document.getElementById('btnFilterBarang');  
  
  if (btnFilterSemua) {
    btnFilterSemua.onclick = () => {
      currentKeuanganFilter = 'semua';
      updateFilterButtons();
      renderKeuanganTable();
    };
  }  
  
  if (btnFilterTransaksi) {
    btnFilterTransaksi.onclick = () => {
      currentKeuanganFilter = 'transaksi';
      updateFilterButtons();
      renderKeuanganTable();
    };
  }  
  
  if (btnFilterPengeluaran) {
    btnFilterPengeluaran.onclick = () => {
      currentKeuanganFilter = 'pengeluaran';
      updateFilterButtons();
      renderKeuanganTable();
    };
  }  
  
  if (btnFilterBarang) {
    btnFilterBarang.onclick = () => {
      currentKeuanganFilter = 'barang';
      updateFilterButtons();
      renderKeuanganTable();
    };
  }
}

function updateFilterButtons() {
  const buttons = ['btnFilterSemua', 'btnFilterTransaksi', 'btnFilterPengeluaran', 'btnFilterBarang'];
  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.remove('active');
  });  
  
  let activeBtnId = 'btnFilterSemua';
  if (currentKeuanganFilter === 'transaksi') activeBtnId = 'btnFilterTransaksi';
  else if (currentKeuanganFilter === 'pengeluaran') activeBtnId = 'btnFilterPengeluaran';
  else if (currentKeuanganFilter === 'barang') activeBtnId = 'btnFilterBarang';
  
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) activeBtn.classList.add('active');
}

function renderKeuanganTable() {
  const bulan = document.getElementById('filterBulan').value;
  const tahun = document.getElementById('filterTahun').value;
  const tbody = document.getElementById('keuanganTableBody');
  if (!tbody) return;
  
  let allMonthData = [];
  
  // ============================================
  // 1. TRANSAKSI (Pemasukan, Refund, Exchange)
  // ============================================
  const transaksiMonth = transaksiData.filter(t => {
    const date = parseToWIBDate(t.tanggal);
    return String(date.getMonth() + 1).padStart(2, '0') === bulan && 
           date.getFullYear() === parseInt(tahun);
  });
  
  allMonthData = allMonthData.concat(transaksiMonth);
  
  // ============================================
  // 2. PENGELUARAN (Biaya Operasional SAJA)
  // ============================================
  const pengeluaranMonth = pengeluaranData.filter(p => {
    const date = new Date(p.waktu);
    const wibTime = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    return String(wibTime.getMonth() + 1).padStart(2, '0') === bulan && 
           wibTime.getFullYear() === parseInt(tahun);
  }).map(p => ({
    tanggal: getLocalDateString(p.waktu),
    waktu: p.waktu,
    jenis: 'Pengeluaran',
    nama: p.jenis,
    alamat: '-',
    banyaknya: 1,
    barang: p.jenis,
    total: parseFloat(p.biaya) || 0,
    status: 'Keluar',
    catatan: p.keterangan + (p.namaKaryawan ? ' - ' + p.namaKaryawan : ''),
    items: [],
    tipeProses: 'pengeluaran-' + p.jenis.toLowerCase().replace(/\s/g, '-'),
    netDifference: 0
  }));
  
  allMonthData = allMonthData.concat(pengeluaranMonth);
  
  // ============================================
  // 3. HITUNG TOTAL (DENGAN FILTER YANG BENAR)
  // ============================================
  let totalPemasukan = 0;
  let totalPengeluaran = 0;
  let totalGrossProfit = 0;
  
  allMonthData.forEach(t => {
    // ✅ Pemasukan NORMAL (bukan refund/exchange)
    if (t.jenis === 'Pemasukan' && !t.tipeProses) {
      totalPemasukan += t.total;
      totalGrossProfit += calculateGrossProfit(t);
    }
    
    // ✅ PERBAIKAN: Hanya hitung pengeluaran OPERASIONAL
    // JANGAN hitung refund/exchange sebagai pengeluaran!
    if (t.jenis === 'Pengeluaran' && 
        t.tipeProses && 
        t.tipeProses.startsWith('pengeluaran-')) {
      totalPengeluaran += t.total;
    }
    
    // ✅ CATATAN: Refund/exchange TIDAK masuk ke totalPengeluaran
    // Mereka hanya ditampilkan di tabel sebagai catatan
  });
  
  updateKeuanganSummary(totalPemasukan, totalPengeluaran, totalGrossProfit);
  
  // ============================================
  // 4. FILTER UNTUK TAMPILAN TABEL
  // ============================================
  let filteredForTable = [...allMonthData];
  
  if (currentKeuanganFilter === 'transaksi') {
    // Tampilkan: Pemasukan + Refund + Exchange
    filteredForTable = filteredForTable.filter(t => 
      t.jenis === 'Pemasukan' || 
      t.tipeProses === 'refund' || 
      t.tipeProses === 'exchange'
    );
  } else if (currentKeuanganFilter === 'pengeluaran') {
    // Tampilkan: HANYA pengeluaran operasional
    filteredForTable = filteredForTable.filter(t => 
      t.jenis === 'Pengeluaran' && 
      (t.tipeProses && t.tipeProses.startsWith('pengeluaran-'))
    );
  } else if (currentKeuanganFilter === 'barang') {
    const barangMonth = barangData.filter(b => {
      const date = parseToWIBDate(b.tanggal);
      const matchMonth = String(date.getMonth() + 1).padStart(2, '0') === bulan && 
                         date.getFullYear() === parseInt(tahun);
      
      const hasJenisTransaksi = b.jenisTransaksi && 
        (b.jenisTransaksi === 'Penambahan Barang Baru' || 
         b.jenisTransaksi === 'Penambahan Stok Lama');
      
      return matchMonth && hasJenisTransaksi;
    }).map(b => {
      // ... existing mapping code ...
      const jenisKelompok = b.jenisKelompok || 'Satuan';
      const banyakItemPerTurunan = b.banyakItemPerTurunan || 1;
      
      const stokKelompokBM1 = b.stokKelompokBM1 || 0;
      const stokKelompokBM2 = b.stokKelompokBM2 || 0;
      const stokTurunanBM1 = b.stokTurunanBM1 || 0;
      const stokTurunanBM2 = b.stokTurunanBM2 || 0;
      
      const totalStokKelompok = stokKelompokBM1 + stokKelompokBM2;
      const totalStokTurunan = stokTurunanBM1 + stokTurunanBM2;
      const totalStokKeseluruhan = (totalStokKelompok * banyakItemPerTurunan) + totalStokTurunan;
      
      const modalBarang = b.modalBarang || 0;
      const hargaJualKelompok = b.hargaJualKelompok || 0;
      const hargaJualTurunan = b.hargaJualTurunan || 0;
      
      const hppKelompok = modalBarang * totalStokKelompok;
      const modalPerTurunan = banyakItemPerTurunan > 0 ? modalBarang / banyakItemPerTurunan : 0;
      const hppTurunan = modalPerTurunan * totalStokTurunan;
      const hppTotal = hppKelompok + hppTurunan;
      
      const totalHargaJualKelompok = hargaJualKelompok * totalStokKelompok;
      const totalHargaJualTurunan = hargaJualTurunan * totalStokTurunan;
      const totalHargaJualKeseluruhan = totalHargaJualKelompok + totalHargaJualTurunan;
      
      const labaKotor = totalHargaJualKeseluruhan - hppTotal;
      
      return {
        tanggal: b.tanggal,
        waktu: b.tanggal + 'T00:00:00',
        jenis: b.jenisTransaksi,
        nama: b.nama,
        alamat: b.alamat || '-',
        
        jenisKelompok: jenisKelompok,
        banyakItemPerTurunan: banyakItemPerTurunan,
        totalStokKelompok: totalStokKelompok,
        totalStokTurunan: totalStokTurunan,
        totalStokKeseluruhan: totalStokKeseluruhan,
        
        modalBarang: modalBarang,
        hargaJualKelompok: hargaJualKelompok,
        hargaJualTurunan: hargaJualTurunan,
        
        hppKelompok: hppKelompok,
        hppTurunan: hppTurunan,
        hppTotal: hppTotal,
        
        totalHargaJualKelompok: totalHargaJualKelompok,
        totalHargaJualTurunan: totalHargaJualTurunan,
        totalHargaJualKeseluruhan: totalHargaJualKeseluruhan,
        
        labaKotor: labaKotor,
        
        barang: b.nama,
        total: hppTotal,
        status: b.status || 'Tambah Barang Baru',
        catatan: b.catatan || ('ID: ' + b.id + ' - ' + getKelompokLabel(b.jenisKelompok)),
        items: [],
        tipeProses: b.jenisTransaksi === 'Penambahan Stok Lama' ? 'tambah-stok-lama' : 'tambah-barang-baru',
        netDifference: 0
      };
    });
    
    filteredForTable = barangMonth;
  }
  
  filteredForTable.sort((a, b) => new Date(a.waktu) - new Date(b.waktu));
  
  if (filteredForTable.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="empty-message">Tidak ada data pada filter ini</td></tr>';
    return;
  }
  
  // ============================================
  // 5. RENDER TABEL (dengan indicator untuk refund/exchange)
  // ============================================
  let currentMonth = null;
  let currentJenisTransaksi = null;
  let rowsHTML = '';
  
  filteredForTable.forEach((t) => {
    const tDate = parseToWIBDate(t.tanggal);
    const tMonth = tDate.getMonth();
    
    if (currentMonth !== null && currentMonth !== tMonth) {
      rowsHTML += '<tr class="month-separator"><td colspan="11"></td></tr>';
    }
    currentMonth = tMonth;
    
    // ... rest of rendering code (existing) ...
    
    // ✅ TAMBAHKAN INDICATOR UNTUK REFUND/EXCHANGE
    let barangList = '<ul class="barang-list">';
    let hargaList = '<ul class="barang-list">';
    let totalHPPList = '<ul class="barang-list">';
    let totalHargaJualList = '<ul class="barang-list">';
    let labaKotor = 0;
    
    if (t.jenis === 'Pemasukan' && !t.tipeProses && t.items && t.items.length > 0) {
      labaKotor = calculateGrossProfit(t);
      
      let totalHPPTransaksi = 0;
      let totalHargaJualTransaksi = 0;
      
      t.items.forEach(item => {
        const typeLabel = getDisplayLabel(item, barangData);
        const prefix = item.isRefunded ? '-' : '+';
        const displayQty = item.qty;
        const itemClass = item.isRefunded ? 'refunded-item' : '';
        
        barangList += '<li class="' + itemClass + '">' + prefix + ' ' + item.nama + ' (' + displayQty + ' ' + typeLabel + ')</li>';
        hargaList += '<li class="' + itemClass + '">' + formatRupiah(item.harga) + '</li>';
        
        let hppPerItem = 0;
        if (item.hargaModalUnit && item.hargaModalUnit > 0) {
          hppPerItem = item.hargaModalUnit;
        } else {
          const barang = barangData.find(b => b.id === item.id);
          if (barang) {
            const banyakItem = barang.banyakItemPerTurunan || 1;
            const modalBarang = barang.modalBarang || 0;
            if (item.typeBarang === 'kelompok') {
              hppPerItem = modalBarang;
            } else {
              hppPerItem = banyakItem > 0 ? modalBarang / banyakItem : modalBarang;
            }
          } else {
            hppPerItem = item.harga * 0.7;
          }
        }
        
        const totalHPPItem = hppPerItem * displayQty;
        const totalHargaJualItem = item.harga * displayQty;
        
        totalHPPTransaksi += totalHPPItem;
        totalHargaJualTransaksi += totalHargaJualItem;
        
        totalHPPList += '<li class="' + itemClass + '">' + formatRupiah(totalHPPItem) + '</li>';
        totalHargaJualList += '<li class="' + itemClass + '">' + formatRupiah(totalHargaJualItem) + '</li>';
      });
      
      totalHargaJualList += '<li style="border-top: 2px solid #ddd; margin-top: 5px; padding-top: 5px;"><strong>Total: ' + formatRupiah(totalHargaJualTransaksi) + '</strong></li>';
      totalHPPList += '<li style="border-top: 2px solid #ddd; margin-top: 5px; padding-top: 5px;"><strong>Total: ' + formatRupiah(totalHPPTransaksi) + '</strong></li>';
      
      barangList += '</ul>';
      hargaList += '</ul>';
      totalHPPList += '</ul>';
      totalHargaJualList += '</ul>';
    } 
    // ✅ REFUND/EXCHANGE - Tampilkan dengan label khusus
    else if (t.tipeProses === 'refund' || t.tipeProses === 'exchange') {
      labaKotor = 0; // Tidak mempengaruhi laba
      
      let totalHPPTransaksi = 0;
      let totalHargaJualTransaksi = 0;
      
      if (t.items && t.items.length > 0) {
        t.items.forEach(item => {
          const typeLabel = getDisplayLabel(item, barangData);
          const prefix = item.isRefunded ? '-' : '+';
          const displayQty = item.qty;
          const itemClass = item.isRefunded ? 'refunded-item' : 'success-item';
          
          barangList += '<li class="' + itemClass + '">' + prefix + ' ' + item.nama + ' (' + displayQty + ' ' + typeLabel + ')</li>';
          hargaList += '<li class="' + itemClass + '">' + formatRupiah(item.harga) + '</li>';
          
          let hppPerItem = 0;
          if (item.hargaModalUnit && item.hargaModalUnit > 0) {
            hppPerItem = item.hargaModalUnit;
          } else {
            const barang = barangData.find(b => b.id === item.id);
            if (barang) {
              const banyakItem = barang.banyakItemPerTurunan || 1;
              const modalBarang = barang.modalBarang || 0;
              if (item.typeBarang === 'kelompok') {
                hppPerItem = modalBarang;
              } else {
                hppPerItem = banyakItem > 0 ? modalBarang / banyakItem : modalBarang;
              }
            }
          }
          
          const totalHPPItem = hppPerItem * displayQty;
          const totalHargaJualItem = item.harga * displayQty;
          
          if (item.isRefunded) {
            totalHPPTransaksi -= totalHPPItem;
            totalHargaJualTransaksi -= totalHargaJualItem;
          } else {
            totalHPPTransaksi += totalHPPItem;
            totalHargaJualTransaksi += totalHargaJualItem;
          }
          
          totalHPPList += '<li class="' + itemClass + '">' + formatRupiah(totalHPPItem) + '</li>';
          totalHargaJualList += '<li class="' + itemClass + '">' + formatRupiah(totalHargaJualItem) + '</li>';
        });
        
        // ✅ LABEL KHUSUS UNTUK REFUND/EXCHANGE
        totalHargaJualList += '<li style="border-top: 2px solid #ddd; margin-top: 5px; padding-top: 5px; color: #f59e0b;"><strong>Net (CATATAN): ' + formatRupiah(totalHargaJualTransaksi) + '</strong></li>';
        totalHPPList += '<li style="border-top: 2px solid #ddd; margin-top: 5px; padding-top: 5px; color: #f59e0b;"><strong>Net (CATATAN): ' + formatRupiah(totalHPPTransaksi) + '</strong></li>';
      }
      barangList += '</ul>';
      hargaList += '</ul>';
      totalHPPList += '</ul>';
      totalHargaJualList += '</ul>';
    } 
    else if (t.jenis === 'Pengeluaran') {
      labaKotor = 0;
      barangList += '<li>' + (t.barang || '-') + '</li></ul>';
      hargaList += '<li>-</li></ul>';
      totalHargaJualList = '<ul class="barang-list"><li>-</li></ul>';
      totalHPPList = '<ul class="barang-list"><li>' + formatRupiah(t.total) + '</li></ul>';
    }
    else if (t.jenis.includes('Penambahan')) {
      // ... existing code for barang ...
    }
    
    let statusClass = '';
    if (t.status === 'Lunas') statusClass = 'status-lunas';
    else if (t.jenis === 'Pengeluaran' || t.tipeProses === 'refund' || t.tipeProses === 'exchange' || t.jenis.includes('Penambahan')) statusClass = 'status-keluar';
    else statusClass = 'status-belum-lunas';
    
    const profitClass = labaKotor >= 0 ? 'profit-positive' : 'profit-negative';
    const rowClass = t.tipeProses === 'tambah-stok-lama' ? 'stok-lama-row' : '';
    
    rowsHTML += '<tr class="' + rowClass + '">' +
      '<td>' + formatDate(t.tanggal) + '</td>' +
      '<td>' + t.jenis + 
        // ✅ TAMBAHKAN LABEL CATATAN UNTUK REFUND/EXCHANGE
        (t.tipeProses === 'refund' ? ' <span style="background: #fbbf24; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">CATATAN</span>' : '') +
        (t.tipeProses === 'exchange' ? ' <span style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">CATATAN</span>' : '') +
      '</td>' +
      '<td>' + t.nama + '</td>' +
      '<td>' + t.alamat + '</td>' +
      '<td>' + barangList + '</td>' +
      '<td>' + hargaList + '</td>' +
      '<td>' + totalHargaJualList + '</td>' +
      '<td>' + totalHPPList + '</td>' +
      '<td><span class="' + profitClass + '">' + formatRupiah(labaKotor) + '</span></td>' +
      '<td><span class="' + statusClass + '">' + t.status + '</span></td>' +
      '<td>' + t.catatan + '</td>' +
    '</tr>';
  });
  
  tbody.innerHTML = rowsHTML;
}

function updateKeuanganSummary(pemasukan, pengeluaran, labaKotor) {
  const saldoBersih = pemasukan - pengeluaran;
  const labaBersih = labaKotor - pengeluaran;  
  document.getElementById('totalPemasukan').textContent = formatRupiah(pemasukan);
  document.getElementById('totalPengeluaran').textContent = formatRupiah(pengeluaran);
  document.getElementById('saldoBulanan').textContent = formatRupiah(saldoBersih);
  document.getElementById('labaKotorBulanan').textContent = formatRupiah(labaKotor);
  document.getElementById('labaBersihBulanan').textContent = formatRupiah(labaBersih);
}

function printKeuanganTable() {
  const tableHTML = document.getElementById('keuanganTable').outerHTML;
  const filterBulan = document.getElementById('filterBulan').options[document.getElementById('filterBulan').selectedIndex].text;
  const filterTahun = document.getElementById('filterTahun').value;
  const totalPemasukan = document.getElementById('totalPemasukan').textContent;
  const totalPengeluaran = document.getElementById('totalPengeluaran').textContent;
  const saldoBulanan = document.getElementById('saldoBulanan').textContent;
  const labaKotorBulanan = document.getElementById('labaKotorBulanan').textContent;
  const printContent = '<!DOCTYPE html>' +
    '<html lang="id">' +
    '<head>' +
      '<meta charset="UTF-8">' +
      '<title>Cetak Rekap Keuangan UD.BM</title>' +
      '<style>' +
        'body { font-family: Arial, sans-serif; }' +
        'h2 { text-align: center; margin-bottom: 5px; }' +
        'p { text-align: center; margin-top: 0; font-size: 14px; }' +
        'table { width: 100%; border-collapse: collapse; margin-top: 20px; }' +
        'th, td { border: 1px solid #000; padding: 8px; text-align: left; font-size: 12px; }' +
        'th { background-color: #f2f2f2; }' +
        '.summary { margin-top: 20px; text-align: right; }' +
        '.summary div { font-weight: bold; margin-bottom: 5px; }' +
        '.barang-list { margin: 0; padding-left: 0; list-style-type: none; }' +
        '@media print {' +
          '.data-table th:nth-child(9), .data-table td:nth-child(9) { display: none; }' +
        '}' +
      '</style>' +
    '</head>' +
    '<body>' +
      '<h2>Rekap Keuangan Bulanan UD.BM</h2>' +
      '<p>Periode: ' + filterBulan + ' ' + filterTahun + '</p>' +
      tableHTML +
      '<div class="summary">' +
        '<div>Total Pemasukan: ' + totalPemasukan + '</div>' +
        '<div>Total Pengeluaran: ' + totalPengeluaran + '</div>' +
        '<div>Saldo Bersih: ' + saldoBulanan + '</div>' +
        '<div>Est. Laba Kotor: ' + labaKotorBulanan + '</div>' +
      '</div>' +
      '<script>' +
        'const table = document.getElementById("keuanganTable");' +
        'if (table) {' +
          'table.querySelectorAll("th:nth-child(9)").forEach(th => th.remove());' +
          'table.querySelectorAll("tbody tr").forEach(row => {' +
            'if(row.cells.length >= 9) {' +
              'row.cells[8].remove();' +
            '}' +
          '});' +
        '}' +
        'window.print();' +
      '</script>' +
    '</body>' +
    '</html>';
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup diblokir! Silakan izinkan popup untuk mencetak.');
    return;
  }
  printWindow.document.write(printContent);
  printWindow.document.close();
}

function updateRealtime() {
  const today = getTodayWIB();  
  const todayTransactions = transaksiData.filter(t => 
    getLocalDateString(t.tanggal) === today && 
    t.jenis === 'Pemasukan' && 
    !t.tipeProses
  );  
  const rtTransaksi = document.getElementById('rtTransaksi');
  if (rtTransaksi) rtTransaksi.textContent = todayTransactions.length;  
  const todayIncome = todayTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
  const rtPemasukan = document.getElementById('rtPemasukan');
  if (rtPemasukan) rtPemasukan.textContent = formatRupiah(todayIncome);  
  const totalItems = todayTransactions.reduce((sum, t) => {
    if (t.items && Array.isArray(t.items)) {
      return sum + t.items.reduce((itemSum, item) => itemSum + (item.qty || 0), 0);
    }
    return sum + (t.banyaknya || 0);
  }, 0);  
  const rtBarangTerjual = document.getElementById('rtBarangTerjual');
  if (rtBarangTerjual) rtBarangTerjual.textContent = totalItems + ' Item';  
  const container = document.getElementById('realtimeList');
  if (!container) return;  
  const recent = todayTransactions.slice(-10).reverse();  
  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-message">Belum ada transaksi hari ini</p>';
    return;
  }  
  container.innerHTML = recent.map(t => {
    let itemDetails = t.barang;
    if (t.items && Array.isArray(t.items) && t.items.length > 0) {
      itemDetails = t.items.map(item => {
        const typeLabel = getDisplayLabel(item, barangData);
        return item.nama + ' (' + item.qty + ' ' + typeLabel + ')';
      }).join(', ');
      if (itemDetails.length > 50) {
        itemDetails = itemDetails.substring(0, 50) + '...';
      }
    }    
    return '<div class="realtime-item">' +
      '<div class="realtime-item-header">' +
        '<strong>' + (t.nama || 'Pelanggan') + '</strong>' +
        '<span class="realtime-item-amount">' + formatRupiah(t.total) + '</span>' +
      '</div>' +
      '<div class="realtime-item-details">' +
        formatDateTime(t.waktu).slice(-8) + ' - ' + itemDetails +
      '</div>' +
    '</div>';
  }).join('');
}

let salesChart = null;

function initDiagram() {
  const filterButtons = document.querySelectorAll('#realtime-diagram .btn-filter');  
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateDiagram(btn.dataset.period);
    });
  });
}

function updateDiagram(period) {
  const ctx = document.getElementById('salesChart');
  if (!ctx) {
    return;
  }  
  const ctxContext = ctx.getContext('2d');
  let labels = [];
  let data = [];
  let periodName = '';
  let allFilteredTransactions = [];
  const today = new Date();  
  const targetTransactions = transaksiData.filter(t => 
    t.jenis === 'Pemasukan' && 
    !t.tipeProses
  );
  if (period === 'daily') {
    periodName = '7 Hari Terakhir';    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = getLocalDateString(date);
      const dayName = date.toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' });
      labels.push(dayName + ' ' + formatDate(dateStr).slice(0, 5));      
      const dayTransactions = targetTransactions.filter(t => 
        getLocalDateString(t.tanggal) === dateStr
      );
      const dayTotal = dayTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
      data.push(dayTotal);
      allFilteredTransactions.push(...dayTransactions);
    }    
  } else if (period === 'weekly') {
    periodName = '4 Minggu Terakhir';    
    for (let i = 3; i >= 0; i--) {
      const endDate = new Date();
      const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
      endDate.setDate(today.getDate() - dayOfWeek + 7 - (i * 7));
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);
      labels.push(startDate.getDate() + '/' + (startDate.getMonth()+1) + ' - ' + endDate.getDate() + '/' + (endDate.getMonth()+1));      
      const startStr = getLocalDateString(startDate);
      const endStr = getLocalDateString(endDate);      
      const weekTransactions = targetTransactions.filter(t => {
        const tDateStr = getLocalDateString(t.tanggal);
        return tDateStr >= startStr && tDateStr <= endStr;
      });
      const weekTotal = weekTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
      data.push(weekTotal);
      allFilteredTransactions.push(...weekTransactions);
    }    
  } else if (period === 'monthly') {
    periodName = '6 Bulan Terakhir';    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
      labels.push(monthStr);      
      const monthTransactions = targetTransactions.filter(t => {
        const tDate = parseToWIBDate(t.tanggal);
        return tDate.getMonth() === date.getMonth() && 
               tDate.getFullYear() === date.getFullYear();
      });
      const monthTotal = monthTransactions.reduce((sum, t) => sum + (t.total || 0), 0);
      data.push(monthTotal);
      allFilteredTransactions.push(...monthTransactions);
    }
  }  
  const totalGrossProfit = allFilteredTransactions.reduce((sum, t) => {
    return sum + calculateGrossProfit(t);
  }, 0);
  if (salesChart) {
    try {
      salesChart.destroy();
    } catch (error) {
    }
    salesChart = null;
  }  
  try {
    salesChart = new Chart(ctxContext, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Penjualan',
          data: data,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return 'Penjualan: ' + formatRupiah(context.parsed.y);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => {
                if (value >= 1000000) {
                  return 'Rp ' + (value / 1000000).toFixed(1) + 'jt';
                } else if (value >= 1000) {
                  return 'Rp ' + (value / 1000).toFixed(0) + 'rb';
                }
                return 'Rp ' + value;
              }
            }
          }
        }
      }
    });
  } catch (error) {
    const chartContainer = ctx.parentElement;
    if (chartContainer) {
      chartContainer.innerHTML = '<p class="empty-message">Gagal memuat diagram. Silakan refresh halaman.</p>';
    }
    return;
  } 
  const periodNameEl = document.getElementById('periodName');
  if (periodNameEl) periodNameEl.textContent = periodName;  
  const total = data.reduce((sum, val) => sum + val, 0);
  const average = data.length > 0 ? total / data.length : 0;
  const transactionCount = allFilteredTransactions.length;  
  const periodTotal = document.getElementById('periodTotal');
  const periodAverage = document.getElementById('periodAverage');
  const periodTransactions = document.getElementById('periodTransactions');
  const periodGrossProfit = document.getElementById('periodGrossProfit');  
  if (periodTotal) periodTotal.textContent = formatRupiah(total);
  if (periodAverage) periodAverage.textContent = formatRupiah(average);
  if (periodTransactions) periodTransactions.textContent = transactionCount;
  if (periodGrossProfit) periodGrossProfit.textContent = formatRupiah(totalGrossProfit);
}

function initPengeluaranTabs() {
  const tabButtons = document.querySelectorAll('.pengeluaran-tabs .tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));      
      btn.classList.add('active');
      const targetContent = document.getElementById(targetTab);
      if (targetContent) targetContent.classList.add('active');
    });
  });
  initPengeluaranModals();
}

function initPengeluaranModals() {
  const modalBangunan = document.getElementById('modalBangunan');
  const btnTambahBangunan = document.getElementById('btnTambahBangunan');
  const btnCancelBangunan = document.getElementById('btnCancelBangunan');
  const formBangunan = document.getElementById('formBangunan');  
  if (btnTambahBangunan) {
    btnTambahBangunan.addEventListener('click', () => {
      if (modalBangunan) modalBangunan.classList.add('show');
    });
  }  
  if (btnCancelBangunan) {
    btnCancelBangunan.addEventListener('click', () => { 
      if (modalBangunan) modalBangunan.classList.remove('show');
      if (formBangunan) formBangunan.reset();
    });
  }  
  if (formBangunan) {
    formBangunan.addEventListener('submit', handleBangunanSubmit);
  }  
  const modalTakTerduga = document.getElementById('modalTakTerduga');
  const btnTambahTakTerduga = document.getElementById('btnTambahTakTerduga');
  const btnCancelTakTerduga = document.getElementById('btnCancelTakTerduga');
  const formTakTerduga = document.getElementById('formTakTerduga');  
  if (btnTambahTakTerduga) {
    btnTambahTakTerduga.addEventListener('click', () => {
      if (modalTakTerduga) modalTakTerduga.classList.add('show');
    });
  }  
  if (btnCancelTakTerduga) {
    btnCancelTakTerduga.addEventListener('click', () => { 
      if (modalTakTerduga) modalTakTerduga.classList.remove('show');
      if (formTakTerduga) formTakTerduga.reset();
    });
  }  
  if (formTakTerduga) {
    formTakTerduga.addEventListener('submit', handleTakTerdugaSubmit);
  }  
  const modalGaji = document.getElementById('modalGaji');
  const btnTambahGaji = document.getElementById('btnTambahGaji');
  const btnCancelGaji = document.getElementById('btnCancelGaji');
  const formGaji = document.getElementById('formGaji');  
  if (btnTambahGaji) {
    btnTambahGaji.addEventListener('click', () => {
      if (modalGaji) modalGaji.classList.add('show');
    });
  }  
  if (btnCancelGaji) {
    btnCancelGaji.addEventListener('click', () => { 
      if (modalGaji) modalGaji.classList.remove('show');
      if (formGaji) formGaji.reset();
    });
  }  
  if (formGaji) {
    formGaji.addEventListener('submit', handleGajiSubmit);
  }  
  document.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', function() { 
      const modal = this.closest('.modal');
      if (modal) modal.classList.remove('show');
    });
  });  
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) { 
      e.target.classList.remove('show'); 
    }
  });
}

async function handleBangunanSubmit(e) {
  e.preventDefault();
  
  if (!isOnline()) {
    alert('❌ Tidak ada koneksi internet. Simpan data memerlukan koneksi online.');
    return;
  }
  
  const nama = document.getElementById('namaDepositBangunan').value.trim();
  const jumlah = parseFloat(document.getElementById('jumlahBangunan').value) || 0;
  const keterangan = document.getElementById('keteranganBangunan').value;
  
  if (!nama) {
    alert("❌ Nama pelanggan harus diisi.");
    return;
  }
  
  if (jumlah <= 0) {
    alert("❌ Jumlah deposit harus lebih dari nol.");
    return;
  }
  
  const waktu = getNowWIB();
  
  let currentBalance = 0;
  try {
    currentBalance = await getCustomerBalance(nama);
  } catch (error) {
  }
  
  const newBalance = currentBalance + jumlah;
  
  const newDeposit = {
    waktu: waktu,
    nama: nama,
    jenis: 'Deposit',
    jumlah: jumlah,
    saldo: newBalance,
    keterangan: keterangan,
    idTransaksi: '',
    toko: 'Owner'
  };
  
  try {
    showLoading(true);
    
    await saveDeposit([newDeposit]);
    
    depositData.push(newDeposit);
    
    renderBangunanTable();
    
    const modalBangunan = document.getElementById('modalBangunan');
    const formBangunan = document.getElementById('formBangunan');
    
    if (modalBangunan) modalBangunan.classList.remove('show');
    if (formBangunan) formBangunan.reset();
    
    alert(`✅ Deposit berhasil ditambahkan!\n\nNama: ${nama}\nJumlah: ${formatRupiah(jumlah)}\nSaldo Baru: ${formatRupiah(newBalance)}`);
    updateDashboard();
    
  } catch (error) {
    alert('❌ Gagal menyimpan data. Silakan cek koneksi dan coba lagi.');
  } finally {
    showLoading(false);
  }
}

async function handleTakTerdugaSubmit(e) {
  e.preventDefault();  
  if (!isOnline()) {
    alert('❌ Tidak ada koneksi internet. Simpan data memerlukan koneksi online.');
    return;
  }  
  const biaya = parseFloat(document.getElementById('biayaTakTerduga').value) || 0;
  const waktu = getNowWIB();
  if (biaya <= 0) {
    alert("Biaya harus lebih dari nol.");
    return;
  }
  const newPengeluaran = {
    waktu: waktu,
    jenis: document.getElementById('jenisTakTerduga').value,
    biaya: biaya,
    keterangan: document.getElementById('keteranganTakTerduga').value,
    namaKaryawan: ''
  };  
  try {
    showLoading(true);    
    await savePengeluaran([newPengeluaran]);    
    pengeluaranData.push(newPengeluaran);
    renderPengeluaranTables();    
    const modalTakTerduga = document.getElementById('modalTakTerduga');
    const formTakTerduga = document.getElementById('formTakTerduga');    
    if (modalTakTerduga) modalTakTerduga.classList.remove('show');
    if (formTakTerduga) formTakTerduga.reset();    
    alert('✅ Biaya berhasil ditambahkan!');
    updateDashboard();    
  } catch (error) {
    alert('❌ Gagal menyimpan data. Silakan cek koneksi dan coba lagi.');
  } finally {
    showLoading(false);
  }
}

async function handleGajiSubmit(e) {
  e.preventDefault();  
  if (!isOnline()) {
    alert('❌ Tidak ada koneksi internet. Simpan data memerlukan koneksi online.');
    return;
  }
  
  const jumlahGaji = parseFloat(document.getElementById('jumlahGaji').value) || 0;
  const waktu = getNowWIB();
  if (jumlahGaji <= 0) {
    alert("Jumlah gaji harus lebih dari nol.");
    return;
  }
  const newPengeluaran = {
    waktu: waktu,
    jenis: 'Gaji Karyawan',
    biaya: jumlahGaji,
    keterangan: document.getElementById('keteranganGaji').value,
    namaKaryawan: document.getElementById('namaKaryawanGaji').value
  };  
  try {
    showLoading(true);    
    await savePengeluaran([newPengeluaran]);    
    pengeluaranData.push(newPengeluaran);
    renderPengeluaranTables();    
    const modalGaji = document.getElementById('modalGaji');
    const formGaji = document.getElementById('formGaji');    
    if (modalGaji) modalGaji.classList.remove('show');
    if (formGaji) formGaji.reset();    
    alert('✅ Gaji karyawan berhasil ditambahkan!');
    updateDashboard();    
  } catch (error) {
    alert('❌ Gagal menyimpan data. Silakan cek koneksi dan coba lagi.');
  } finally {
    showLoading(false);
  }
}

function renderPengeluaranTables() {
  renderBangunanTable();
  renderTakTerdugaTable();
  renderGajiTable();
}

function renderBangunanTable() {
  const tbody = document.getElementById('bangunanTableBody');
  if (!tbody) return;
  
  const customerMap = {};
  
  depositData.forEach(item => {
    if (!customerMap[item.nama]) {
      customerMap[item.nama] = [];
    }
    customerMap[item.nama].push(item);
  });
  
  if (Object.keys(customerMap).length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-message">Belum ada data deposit</td></tr>';
    return;
  }
  
  let html = '';
  let grandTotal = 0;
  
  Object.keys(customerMap).sort().forEach(customerName => {
    const transactions = customerMap[customerName].sort((a, b) => 
      new Date(a.waktu) - new Date(b.waktu)
    );
    
    const latestBalance = transactions[transactions.length - 1].saldo;
    grandTotal += latestBalance;
    
    html += `<tr class="customer-section-header">
      <td colspan="8" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; font-weight: bold; padding: 12px;">
        <i class="fas fa-user"></i> ${customerName} - Saldo: ${formatRupiah(latestBalance)}
      </td>
    </tr>`;
    
    html += `<tr class="section-subheader">
      <td colspan="8" style="background: #eff6ff; font-weight: 600; padding: 8px;">
        <i class="fas fa-plus-circle"></i> Riwayat Deposit
      </td>
    </tr>`;
    
    transactions.filter(t => t.jenis === 'Deposit').forEach(item => {
      html += `<tr>
        <td>${formatDateTime(item.waktu)}</td>
        <td>${item.nama}</td>
        <td><span class="kelompok-badge" style="background: #10b981;">Deposit</span></td>
        <td>${item.keterangan || '-'}</td>
        <td>${formatRupiah(item.jumlah)}</td>
        <td><strong>${formatRupiah(item.saldo)}</strong></td>
        <td>-</td>
        <td>${item.toko || '-'}</td>
      </tr>`;
    });
    
    const usageTransactions = transactions.filter(t => t.jenis === 'Penggunaan');
    if (usageTransactions.length > 0) {
      html += `<tr class="section-subheader">
        <td colspan="8" style="background: #fef3c7; font-weight: 600; padding: 8px;">
          <i class="fas fa-shopping-cart"></i> Riwayat Penggunaan
        </td>
      </tr>`;
      
      usageTransactions.forEach(item => {
        html += `<tr>
          <td>${formatDateTime(item.waktu)}</td>
          <td>${item.nama}</td>
          <td><span class="kelompok-badge" style="background: #f59e0b;">Penggunaan</span></td>
          <td>${item.keterangan || '-'}</td>
          <td>${formatRupiah(Math.abs(item.jumlah))}</td>
          <td><strong>${formatRupiah(item.saldo)}</strong></td>
          <td>${item.idTransaksi || '-'}</td>
          <td>${item.toko || '-'}</td>
        </tr>`;
      });
    }
    
    html += `<tr style="height: 10px;"><td colspan="8"></td></tr>`;
  });
  
  tbody.innerHTML = html;
  
  const totalBangunan = document.getElementById('totalBangunan');
  if (totalBangunan) totalBangunan.textContent = formatRupiah(grandTotal);
}

function renderTakTerdugaTable() {
  const tbody = document.getElementById('takTerdugaTableBody');
  if (!tbody) return;  
  const takTerdugaData = pengeluaranData.filter(p => 
    p.jenis !== 'Simpan Uang Bangunan' && p.jenis !== 'Gaji Karyawan'
  );
  const sortedData = [...takTerdugaData].sort((a, b) => new Date(b.waktu) - new Date(a.waktu));  
  if (sortedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Belum ada data biaya</td></tr>';
    const totalTakTerduga = document.getElementById('totalTakTerduga');
    if (totalTakTerduga) totalTakTerduga.textContent = 'Rp 0';
    return;
  }
  tbody.innerHTML = sortedData.map((item) => {
    const biaya = parseFloat(item.biaya) || 0;
    return '<tr>' +
      '<td>' + formatDateTime(item.waktu) + '</td>' +
      '<td>' + (item.jenis || '-') + '</td>' +
      '<td>' + formatRupiah(biaya) + '</td>' +
      '<td>' + (item.keterangan || '-') + '</td>' +
      '<td>' +
        '<button class="btn-delete" onclick="deletePengeluaranItem(\'' + item.waktu + '\', ' + biaya + ')">' +
          '<i class="fas fa-trash"></i> Hapus' +
        '</button>' +
      '</td>' +
    '</tr>';
  }).join('');  
  const total = takTerdugaData.reduce((sum, item) => sum + (parseFloat(item.biaya) || 0), 0);
  const totalTakTerduga = document.getElementById('totalTakTerduga');
  if (totalTakTerduga) totalTakTerduga.textContent = formatRupiah(total);
}

function renderGajiTable() {
  const tbody = document.getElementById('gajiTableBody');
  if (!tbody) return;  
  const gajiData = pengeluaranData.filter(p => p.jenis === 'Gaji Karyawan');
  const sortedData = [...gajiData].sort((a, b) => new Date(b.waktu) - new Date(a.waktu));  
  if (sortedData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-message">Belum ada data gaji</td></tr>';
    const totalGaji = document.getElementById('totalGaji');
    if (totalGaji) totalGaji.textContent = 'Rp 0';
    return;
  }
  tbody.innerHTML = sortedData.map((item) => {
    const biaya = parseFloat(item.biaya) || 0;
    return '<tr>' +
      '<td>' + formatDateTime(item.waktu) + '</td>' +
      '<td>' + (item.namaKaryawan || '-') + '</td>' +
      '<td>' + formatRupiah(biaya) + '</td>' +
      '<td>' + (item.keterangan || '-') + '</td>' +
      '<td>' +
        '<button class="btn-delete" onclick="deletePengeluaranItem(\'' + item.waktu + '\', ' + biaya + ')">' +
          '<i class="fas fa-trash"></i> Hapus' +
        '</button>' +
      '</td>' +
    '</tr>';
  }).join('');  
  const total = gajiData.reduce((sum, item) => sum + (parseFloat(item.biaya) || 0), 0);
  const totalGaji = document.getElementById('totalGaji');
  if (totalGaji) totalGaji.textContent = formatRupiah(total);
}

window.deletePengeluaranItem = async function(waktu, biaya) {
  if (!isOnline()) {
    alert('❌ Tidak ada koneksi internet. Hapus data memerlukan koneksi online.');
    return;
  }  
  if (confirm('Yakin ingin menghapus data pengeluaran ini?')) {
    try {
      showLoading(true);      
      await deletePengeluaran(waktu, biaya);      
      const index = pengeluaranData.findIndex(p => p.waktu === waktu && p.biaya === biaya);
      if (index !== -1) {
        pengeluaranData.splice(index, 1);
      }      
      renderPengeluaranTables();
      alert('✅ Data berhasil dihapus!');
      updateDashboard();      
    } catch (error) {
      alert('❌ Gagal menghapus data. Silakan coba lagi.');
    } finally {
      showLoading(false);
    }
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Load data HANYA SEKALI di awal
    await loadAllData();
  } catch (error) {
    console.error('Error loading initial data:', error);
  }  
  
  initNavigation();
  initStokManagement();
  initKeuangan();
  initDiagram();
  initPengeluaranTabs();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  const activeNavItem = document.querySelector('.nav-item.active');
  const initialPage = activeNavItem ? activeNavItem.dataset.page : 'dashboard';  
  
  setTimeout(() => {
    loadPageData(initialPage); // Hanya render, data sudah di-load
  }, 100);
  
  // Event listener untuk reload data manual (jika diperlukan)
  window.addEventListener('dataReloaded', async () => {
    await refreshData(); // Refresh data dari server
    const currentNavItem = document.querySelector('.nav-item.active');
    const currentPage = currentNavItem ? currentNavItem.dataset.page : null;
    if (currentPage) {
      renderPage(currentPage); // Render ulang page dengan data baru
    }
  });
});
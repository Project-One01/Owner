const APPS_SCRIPT_URL = `https://script.google.com/macros/s/AKfycbzlZkalpjxXzYUKt6fpFNwg6S_1Vy9yV-cMhCMQ2aaXFyRwbWAexsOc5aOdgQuZYeBu/exec`;

function parseYYYYMMDD(dateString) {
  if (!dateString) return new Date();
  if (dateString instanceof Date) return dateString;
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    return new Date(year, month, day);
  }
  return new Date(dateString);
}

function getTodayWIB() {
  const now = new Date();
  const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, "0");
  const day = String(wibTime.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNowWIB() {
  const now = new Date();
  const wibTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, "0");
  const day = String(wibTime.getDate()).padStart(2, "0");
  const hours = String(wibTime.getHours()).padStart(2, "0");
  const minutes = String(wibTime.getMinutes()).padStart(2, "0");
  const seconds = String(wibTime.getSeconds()).padStart(2, "0");
  const ms = String(wibTime.getMilliseconds()).padStart(3, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}+07:00`;
}

function getLocalDateString(dateInput) {
  if (!dateInput) return getTodayWIB();
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) {
    return getTodayWIB();
  }
  const wibTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const year = wibTime.getFullYear();
  const month = String(wibTime.getMonth() + 1).padStart(2, "0");
  const day = String(wibTime.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseToWIBDate(dateString) {
  if (!dateString) return new Date();
  if (dateString instanceof Date) return dateString;
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const day = parseInt(match[3]);
    const wibDate = new Date(year, month, day, 0, 0, 0);
    return wibDate;
  }
  const date = new Date(dateString);
  return new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
}

function isSameDay(date1, date2) {
  const d1 = getLocalDateString(date1);
  const d2 = getLocalDateString(date2);
  return d1 === d2;
}

function isOnline() {
  return navigator.onLine;
}

function formatRupiah(number) {
  if (isNaN(number) || number === null) number = 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(number);
}

function formatDate(dateInput) {
  if (!dateInput) return "-";
  const date = parseToWIBDate(dateInput);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(dateInput) {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  const wibTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  const day = String(wibTime.getDate()).padStart(2, "0");
  const month = String(wibTime.getMonth() + 1).padStart(2, "0");
  const year = wibTime.getFullYear();
  const hours = String(wibTime.getHours()).padStart(2, "0");
  const minutes = String(wibTime.getMinutes()).padStart(2, "0");
  const seconds = String(wibTime.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function updateDateTime() {
  const now = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  };
  const dateTimeEl = document.getElementById("dateTime");
  if (dateTimeEl) {
    dateTimeEl.textContent = now.toLocaleString("id-ID", options);
  }
  const currentDateTime = document.getElementById("currentDateTime");
  if (currentDateTime) {
    currentDateTime.textContent = now.toLocaleString("id-ID", options);
  }
}

function getKelompokLabel(jenisKelompok) {
  const labels = {
    satuan: "Satuan",
    kotak: "Kotak",
    kodi: "Kodi",
    meter: "Meter",
    kilogram: "Kg",
    keping: "Keping",
    dumptruck: "Dump Truck"
  };
  return labels[jenisKelompok.toLowerCase()] || "Satuan";
}

function getSatuanTurunanLabel(jenisKelompok) {
  const labels = {
    satuan: "Satuan",
    kotak: "Satuan",
    kodi: "Satuan",
    meter: "Sentimeter",
    kilogram: "Gram",
    keping: "Keping",
    dumptruck: "Dump Truck"
  };
  return labels[jenisKelompok.toLowerCase()] || "Satuan";
}

function getDisplayLabel(item, barangData) {
  const barang = barangData ? barangData.find((b) => b.id === item.id) : null;
  const jenisKelompok = item.jenisKelompok || (barang ? barang.jenisKelompok : null) || "Satuan";
  const typeBarang = item.typeBarang || (item.isKotak ? "kelompok" : "turunan");

  if (typeBarang === "kelompok") {
    return getKelompokLabel(jenisKelompok);
  } else {
    return getSatuanTurunanLabel(jenisKelompok);
  }
}

function getBanyakItemPerTurunan(jenisKelompok, customValue = null) {
  const jenisLower = jenisKelompok.toLowerCase();

  if (jenisLower === "kodi") return 20;
  if (jenisLower === "meter") return 100;
  if (jenisLower === "kilogram") return 1000;
  if (jenisLower === "satuan") return 1;
  if (jenisLower === "keping") return 1;
  if (jenisLower === "dumptruck") return 1;
  if (jenisLower === "kotak") {
    return customValue && customValue > 0 ? customValue : 1;
  }
  return 1;
}

function calculateTotalStokForBarang(idBarang, barangDataArray, source = "BM1") {
  const allRecords = barangDataArray.filter((b) => b.id === idBarang);

  let totalStok = 0;

  allRecords.forEach((record) => {
    const banyakItem = record.banyakItemPerTurunan || 1;
    let stokKelompok = 0;
    let stokTurunan = 0;

    if (source === "BM1") {
      stokKelompok = record.stokKelompokBM1 || 0;
      stokTurunan = record.stokTurunanBM1 || 0;
    } else {
      stokKelompok = record.stokKelompokBM2 || 0;
      stokTurunan = record.stokTurunanBM2 || 0;
    }

    totalStok += stokKelompok * banyakItem + stokTurunan;
  });

  return totalStok;
}

async function updateDetailTransaksi(idTrans, updatedItems) {
  if (!idTrans || !Array.isArray(updatedItems)) {
    throw new Error("ID Transaksi atau items tidak valid");
  }

  const validatedItems = updatedItems.map((item) => ({
    idTrans: idTrans,
    tanggal: item.tanggal || getTodayWIB(),
    id: item.id,
    nama: item.nama,
    harga: parseFloat(item.harga) || 0,
    qty: parseInt(item.qty) || 0,
    typeBarang: item.typeBarang || (item.isKotak ? "kelompok" : "turunan"),
    hargaModalUnit: parseFloat(item.hargaModalUnit) || 0,
    qtyOriginal: parseInt(item.qtyOriginal) || item.qty,
    isRefunded: item.isRefunded || false,
    isTukar: item.isTukar || false,
    stokSource: item.stokSource || "BM1",
  }));

  return await sendToSheet("UPDATE_DETAIL_TRANSAKSI", {
    idTrans: idTrans,
    items: validatedItems,
  });
}

function isKelompokFixed(jenisKelompok) {
  const fixedTypes = ["kodi", "meter", "kilogram"];
  return fixedTypes.includes(jenisKelompok.toLowerCase());
}

function getBarangModalPrice(barang, isKelompok) {
  if (!barang) return 0;
  const jenisKelompok = barang.jenisKelompok || "satuan";
  const banyakItemPerTurunan = barang.banyakItemPerTurunan || 1;
  const modalBarang = barang.modalBarang || 0;
  if (jenisKelompok.toLowerCase() === "satuan") {
    return modalBarang;
  }
  if (isKelompok) {
    return modalBarang;
  } else {
    return banyakItemPerTurunan > 0 ? modalBarang / banyakItemPerTurunan : modalBarang;
  }
}

async function loadDepositData() {
  const response = await sendToSheet("FETCH_DEPOSIT", {});
  if (!response.success) return [];

  return response.result.map((item) => ({
    waktu: item.waktu,
    nama: item.nama || "",
    jenis: item.jenis || "Deposit",
    jumlah: parseFloat(item.jumlah) || 0,
    saldo: parseFloat(item.saldo) || 0,
    keterangan: item.keterangan || "",
    idTransaksi: item.idTransaksi || "",
    toko: item.toko || "",
  }));
}

async function saveDeposit(data) {
  const dataArray = Array.isArray(data) ? data : [data];

  const depositData = dataArray.map((item) => ({
    waktu: item.waktu || getNowWIB(),
    nama: item.nama || "",
    jenis: item.jenis || "Deposit",
    jumlah: parseFloat(item.jumlah) || 0,
    saldo: parseFloat(item.saldo) || 0,
    keterangan: item.keterangan || "",
    idTransaksi: item.idTransaksi || "",
    toko: item.toko || "",
  }));

  return await sendToSheet("SAVE_DEPOSIT", { data: depositData });
}

async function getCustomerBalance(customerName) {
  const response = await sendToSheet("GET_CUSTOMER_BALANCE", { customerName });
  if (!response.success) return 0;
  return response.balance || 0;
}

async function searchCustomerDeposit(searchQuery) {
  const response = await sendToSheet("SEARCH_CUSTOMER_DEPOSIT", { searchQuery });
  if (!response.success) return [];
  return response.result || [];
}

function convertStokToSeparate(totalStok, banyakItemPerTurunan) {
  if (banyakItemPerTurunan <= 1) {
    return {
      stokKelompok: totalStok,
      stokTurunan: 0,
    };
  }

  const stokKelompok = Math.floor(totalStok / banyakItemPerTurunan);
  const stokTurunan = totalStok % banyakItemPerTurunan;
  return { stokKelompok, stokTurunan };
}

function convertStokToTotal(stokKelompok, stokTurunan, banyakItemPerTurunan) {
  return stokKelompok * banyakItemPerTurunan + stokTurunan;
}

async function sendToSheet(action, data) {
  if (!isOnline()) {
    throw new Error("Tidak ada koneksi internet");
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      cache: "no-cache",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ action, ...data }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error: ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

async function loadBarangData() {
  const response = await sendToSheet("FETCH_BARANG", {});
  if (response.success) {
    return response.result.map((barang) => {
      const jenisKelompok = barang.jenisKelompok || "Satuan";
      const banyakItemPerTurunan = barang.banyakItemPerTurunan || 1;
      const stokKelompokBM1 = barang.stokKelompokBM1 || 0;
      const stokKelompokBM2 = barang.stokKelompokBM2 || 0;
      const stokTurunanBM1 = barang.stokTurunanBM1 || 0;
      const stokTurunanBM2 = barang.stokTurunanBM2 || 0;
      const totalStokBM1 = stokKelompokBM1 * banyakItemPerTurunan + stokTurunanBM1;
      const totalStokBM2 = stokKelompokBM2 * banyakItemPerTurunan + stokTurunanBM2;
      return {
        tanggal: barang.tanggal,
        id: barang.id,
        nama: barang.nama,
        jenisKelompok: jenisKelompok,
        banyakItemPerTurunan: banyakItemPerTurunan,
        jenisTurunan: barang.jenisTurunan || "satuan",
        stokKelompokBM1: stokKelompokBM1,
        stokKelompokBM2: stokKelompokBM2,
        stokTurunanBM1: stokTurunanBM1,
        stokTurunanBM2: stokTurunanBM2,
        modalBarang: barang.modalBarang || 0,
        hargaJualKelompok: barang.hargaJualKelompok || 0,
        hargaJualTurunan: barang.hargaJualTurunan || 0,
        stokBM1: totalStokBM1,
        stokBM2: totalStokBM2,
        totalItem: barang.totalItem || totalStokBM1 + totalStokBM2,
        totalItemTerjual: barang.totalItemTerjual || 0,
        totalHargaItemTerjual: barang.totalHargaItemTerjual || 0,
        totalModal: barang.totalModal || 0,
        keuntunganMargin: barang.keuntunganMargin || 0,
        jenisTransaksi: barang.jenisTransaksi || "Penambahan Barang Baru",
        alamat: barang.alamat || "-",
        status: barang.status || "Tambah Barang Baru",
        catatan: barang.catatan || "",
      };
    });
  }
  return [];
}

/**
 * Fungsi 1: Menghapus barang UTAMA berdasarkan ID
 * Digunakan untuk menghapus barang yang belum pernah ada transaksi
 * Akan menghapus SEMUA record (barang utama + semua batch) dengan ID tersebut
 */


/**
 * Fungsi 2: Menghapus BATCH LAMA (Penambahan Stok Lama) yang sudah habis stoknya
 * Digunakan setelah batch promotion - menghapus batch yang sudah dipindahkan ke barang utama
 * Hanya menghapus 1 record spesifik berdasarkan ID + Tanggal + Jenis
 */
async function deleteEmptyBatch(idBarang, tanggalBatch, jenisTransaksi = "Penambahan Stok Lama") {
  try {
    const result = await sendToSheet("DELETE_EMPTY_BATCH", { 
      id: idBarang,
      tanggal: tanggalBatch,
      jenisTransaksi: jenisTransaksi
    });
    
    if (!result.success) {
      throw new Error(result.message || "Gagal menghapus batch kosong");
    }
    
    return result;
  } catch (error) {
    console.error("Error deleting empty batch:", error);
    throw new Error("Gagal menghapus batch kosong: " + error.message);
  }
}

async function loadTransaksiData() {
  const response = await sendToSheet("FETCH_TRANSAKSI", {});
  if (response.success) {
    const transactions = (response.result.transactions || []).map((trans) => ({
      ...trans,
      items: (trans.items || []).map((item) => ({
        ...item,
        stokSource: item.stokSource || "BM1",
        qtyOriginal: item.qtyOriginal || item.qty,
        typeBarang: item.typeBarang || (item.isKotak ? "kelompok" : "turunan"),
        isKotak: item.typeBarang === "kelompok" || item.isKotak,
      })),
    }));
    return transactions;
  }
  return [];
}

async function loadPengeluaranData() {
  const response = await sendToSheet("FETCH_PENGELUARAN", {});
  if (!response.success) return [];
  return response.result.map((item) => ({
    waktu: item.waktu,
    jenis: item.jenis,
    biaya: item.biaya || 0,
    keterangan: item.keterangan || "",
    namaKaryawan: item.namaKaryawan || "",
  }));
}

async function saveBarangData(data) {
  const dataToSave = Array.isArray(data) ? data : [data];
  const validatedData = dataToSave.map((barang) => {
    const jenisKelompok = barang.jenisKelompok || "satuan";
    const banyakItemPerTurunan = barang.banyakItemPerTurunan || getBanyakItemPerTurunan(jenisKelompok);
    let stokKelompokBM1, stokTurunanBM1, stokKelompokBM2, stokTurunanBM2;
    if (barang.stokKelompokBM1 !== undefined) {
      stokKelompokBM1 = barang.stokKelompokBM1 || 0;
      stokTurunanBM1 = barang.stokTurunanBM1 || 0;
      stokKelompokBM2 = barang.stokKelompokBM2 || 0;
      stokTurunanBM2 = barang.stokTurunanBM2 || 0;
    } else {
      const totalBM1 = barang.stokBM1 || 0;
      const totalBM2 = barang.stokBM2 || 0;
      const separateBM1 = convertStokToSeparate(totalBM1, banyakItemPerTurunan);
      const separateBM2 = convertStokToSeparate(totalBM2, banyakItemPerTurunan);
      stokKelompokBM1 = separateBM1.stokKelompok;
      stokTurunanBM1 = separateBM1.stokTurunan;
      stokKelompokBM2 = separateBM2.stokKelompok;
      stokTurunanBM2 = separateBM2.stokTurunan;
    }

    return {
      tanggal: barang.tanggal || getTodayWIB(),
      id: barang.id,
      nama: barang.nama,
      jenisKelompok: jenisKelompok,
      banyakItemPerTurunan: banyakItemPerTurunan,
      jenisTurunan: getSatuanTurunanLabel(jenisKelompok).toLowerCase(),
      stokKelompokBM1: stokKelompokBM1,
      stokKelompokBM2: stokKelompokBM2,
      stokTurunanBM1: stokTurunanBM1,
      stokTurunanBM2: stokTurunanBM2,
      modalBarang: barang.modalBarang || 0,
      hargaJualKelompok: barang.hargaJualKelompok || 0,
      hargaJualTurunan: barang.hargaJualTurunan || 0,
      totalItem: barang.totalItem || 0,
      totalItemTerjual: barang.totalItemTerjual || 0,
      totalHargaItemTerjual: barang.totalHargaItemTerjual || 0,
      totalModal: barang.totalModal || 0,
      keuntunganMargin: barang.keuntunganMargin || 0,
      jenisTransaksi: barang.jenisTransaksi || "Penambahan Barang Baru",
      alamat: barang.alamat || "-",
      status: barang.status || "Tambah Barang Baru",
      catatan: barang.catatan || "",
    };
  });

  return await sendToSheet("SAVE_BARANG", { data: validatedData });
}

async function saveTransaksiData(transaksi, detailData = []) {
  const transaksiArray = Array.isArray(transaksi) ? transaksi : [transaksi];

  const validatedTransaksi = transaksiArray.map((trans) => ({
    id: trans.id,
    noStruk: trans.noStruk || "",
    tanggal: trans.tanggal || getTodayWIB(),
    waktu: trans.waktu || getNowWIB(),
    jenis: trans.jenis || "Pemasukan",
    nama: trans.nama || "",
    alamat: trans.alamat || "",
    banyaknya: parseInt(trans.banyaknya) || 0,
    barang: trans.barang || "",
    total: parseFloat(trans.total) || 0,
    bayar: parseFloat(trans.bayar) || 0,
    sisa: parseFloat(trans.sisa) || 0,
    status: trans.status || "Selesai",
    catatan: trans.catatan || "",
    tipeProses: trans.tipeProses || "",
    netDifference: parseFloat(trans.netDifference) || 0,
    stokSource: trans.stokSource || "BM1",
    tipeAwal: trans.tipeAwal || "",
  }));

  const validatedDetailData = detailData.map((detail) => ({
    idTrans: detail.idTrans,
    tanggal: detail.tanggal || getTodayWIB(),
    id: detail.id,
    nama: detail.nama,
    harga: detail.harga || 0,
    qty: detail.qty || 0,
    typeBarang: detail.typeBarang || (detail.isKotak ? "kelompok" : "turunan"),
    hargaModalUnit: detail.hargaModalUnit || 0,
    qtyOriginal: detail.qtyOriginal || detail.qty,
    isRefunded: detail.isRefunded || false,
    isTukar: detail.isTukar || false,
    stokSource: detail.stokSource || "BM1",
    diskonPersen: parseFloat(detail.diskonPersen) || 0,
    diskonRupiah: parseFloat(detail.diskonRupiah) || 0,
  }));

  return await sendToSheet("SAVE_TRANSAKSI", {
    data: validatedTransaksi,
    detailData: validatedDetailData,
  });
}

async function savePengeluaran(data) {
  const dataArray = Array.isArray(data) ? data : [data];
  const pengeluaranData = dataArray.map((item) => ({
    waktu: item.waktu || getNowWIB(),
    jenis: item.jenis || "Biaya",
    biaya: parseFloat(item.biaya) || 0,
    keterangan: item.keterangan || "",
    namaKaryawan: item.namaKaryawan || "",
  }));
  return await sendToSheet("SAVE_PENGELUARAN", { data: pengeluaranData });
}

async function deletePengeluaran(waktu, biaya) {
  return await sendToSheet("DELETE_PENGELUARAN", { waktu, biaya });
}

async function reloadPageData() {
  window.dispatchEvent(new CustomEvent("dataReloaded"));
}

function updateConnectionStatus() {
  const statusEl = document.getElementById("connectionStatus");
  const statusText = document.getElementById("statusText");
  if (!statusEl || !statusText) return;
  if (isOnline()) {
    statusEl.className = "connection-status online";
    statusText.textContent = "Online";
  } else {
    statusEl.className = "connection-status offline";
    statusText.textContent = "Offline";
  }
}

window.addEventListener("online", () => {
  updateConnectionStatus();
  reloadPageData();
});

window.addEventListener("offline", () => {
  updateConnectionStatus();
});

function terbilang(angka) {
  const bilangan = [
    "",
    "Satu",
    "Dua",
    "Tiga",
    "Empat",
    "Lima",
    "Enam",
    "Tujuh",
    "Delapan",
    "Sembilan",
    "Sepuluh",
    "Sebelas",
  ];

  if (angka === 0) return "Nol";
  if (angka < 12) return bilangan[angka];
  if (angka < 20) return terbilang(angka - 10) + " Belas";

  if (angka < 100) {
    const puluhan = terbilang(Math.floor(angka / 10)) + " Puluh";
    const satuan = angka % 10;
    return satuan > 0 ? puluhan + " " + terbilang(satuan) : puluhan;
  }

  if (angka < 200) {
    const sisa = angka - 100;
    return sisa > 0 ? "Seratus " + terbilang(sisa) : "Seratus";
  }

  if (angka < 1000) {
    const ratusan = terbilang(Math.floor(angka / 100)) + " Ratus";
    const sisa = angka % 100;
    return sisa > 0 ? ratusan + " " + terbilang(sisa) : ratusan;
  }

  if (angka < 2000) {
    const sisa = angka - 1000;
    return sisa > 0 ? "Seribu " + terbilang(sisa) : "Seribu";
  }

  if (angka < 1000000) {
    const ribuan = terbilang(Math.floor(angka / 1000)) + " Ribu";
    const sisa = angka % 1000;
    return sisa > 0 ? ribuan + " " + terbilang(sisa) : ribuan;
  }

  if (angka < 1000000000) {
    const jutaan = terbilang(Math.floor(angka / 1000000)) + " Juta";
    const sisa = angka % 1000000;
    return sisa > 0 ? jutaan + " " + terbilang(sisa) : jutaan;
  }

  if (angka < 1000000000000) {
    const miliaran = terbilang(Math.floor(angka / 1000000000)) + " Miliar";
    const sisa = angka % 1000000000;
    return sisa > 0 ? miliaran + " " + terbilang(sisa) : miliaran;
  }

  return "Angka terlalu besar";
}

async function loadCatatanData() {
  const response = await sendToSheet("FETCH_CATATAN", {});
  if (!response.success) return [];
  return response.result.map((item) => ({
    id: item.id,
    judul: item.judul || "",
    isi: item.isi || "",
    waktu: item.waktu,
    diubah: item.diubah || null,
    charCount: item.charCount || 0,
  }));
}

async function saveCatatanData(catatan) {
  return await sendToSheet("SAVE_CATATAN", { data: catatan });
}

async function deleteCatatanData(id) {
  return await sendToSheet("DELETE_CATATAN", { id: id });
}

function initGlobalAPI() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  updateConnectionStatus();
  setInterval(updateConnectionStatus, 5000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initGlobalAPI);
} else {
  initGlobalAPI();
}

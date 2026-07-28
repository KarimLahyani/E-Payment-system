const { pool } = require('./database');

// Fonction pour normaliser les noms de produits
const normalizeProductName = (label) => label.charAt(0).toUpperCase() + label.slice(1);

const prepareSaleItemValues = (item, basketDataId) => [
  basketDataId,
  item.productCode || '',
  item.amount || '',
  item.quantity || '',
  item.addProdCode || '',
  item.reverseSale || '',
  item.saleChannel || '',
  item.rebateLabel || '',
  item.addProdInfo || '',
  item.pumpId || item.pump_id || ''
];

// Transformer un SaleItem pour la réponse API
const transformSaleItem = (item) => ({
  itemId: item.item_id || item.itemId || '',
  productName: normalizeProductName(item.product_name || item.productName || ''),
  productCode: item.product_code || item.productCode || '',
  amount: item.amount || '',
  quantity: item.quantity || '',
  taxCode: item.tax_code || item.taxCode || '',
  addProdCode: item.add_prod_code || item.addProdCode || '',
  reverseSale: item.reverse_sale || item.reverseSale || '',
  unitPrice: item.unit_price || item.unitPrice || '',
  unitMeasure: item.unit_measure || item.unitMeasure || '',
  saleChannel: item.sale_channel || item.saleChannel || '',
  rebateLabel: item.rebate_label || item.rebateLabel || '',
  addProdInfo: item.add_prod_info || item.addProdInfo || '',
  isSelected: item.is_selected || item.isSelected || false,
  createdAt: item.created_at || item.createdAt || ''
});

// Générer des SaleItem par défaut
const generateDefaultSaleItems = (count = 35) => Array.from({ length: count }, (_, i) => ({
  itemId: '',
  productName: `Item${i + 1}`,
  productCode: '',
  amount: '',
  quantity: '',
  taxCode: '',
  addProdCode: '',
  reverseSale: '',
  unitPrice: '',
  unitMeasure: '',
  saleChannel: '',
  rebateLabel: '',
  addProdInfo: '',
  isSelected: false,
  createdAt: ''
}));

// Fonction pour générer l'en-tête de longueur (4 octets en hexadécimal)
const generateLengthHeader = (message) => {
  const length = Buffer.from(message, 'latin1').length; // Length in bytes
  const header = Buffer.alloc(4); // 4 bytes
  header.writeUInt32BE(length, 0); // Write length as 32-bit unsigned integer, big-endian
  return header; // Buffer object with raw bytes
};

// Fonction pour insérer des données dans la base de données avec gestion d'erreurs
const insertWithErrorHandling = async (query, values, successMessage) => {
  try {
    const result = await pool.query(query, values);
    return result;
  } catch (error) {
    console.error(`Error during insertion:`, error);
    return null;
  }
};

module.exports = {
  normalizeProductName,
  prepareSaleItemValues,
  transformSaleItem,
  generateDefaultSaleItems,
  generateLengthHeader,
  insertWithErrorHandling
};
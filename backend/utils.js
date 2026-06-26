const { pool } = require('./database');

// Fonction pour normaliser les étiquettes de bouton
const normalizeButtonLabel = (label) => label.charAt(0).toUpperCase() + label.slice(1);

// Préparer les valeurs pour l'insertion d'un SaleItem dans la base de données
const prepareSaleItemValues = (item, amountDataId) => [
  amountDataId,
  item.itemId || '',
  item.buttonLabel || `Item${i}`, // Fallback si buttonLabel est absent
  item.productCode || '',
  item.amount || '',
  item.quantity || '',
  item.taxCode || '',
  item.addProdCode || '',
  item.reverseSale || '',
  item.unitPrice || '',
  item.unitMeasure || '',
  item.saleChannel || '',
  item.rebateLabel || '',
  item.addProdInfo || '',
  item.isSelected !== undefined ? item.isSelected : false
];

// Transformer un SaleItem pour la réponse API
const transformSaleItem = (item) => ({
  itemId: item.item_id || '',
  buttonLabel: normalizeButtonLabel(item.button_label),
  productCode: item.product_code || '',
  amount: item.amount || '',
  quantity: item.quantity || '',
  taxCode: item.tax_code || '',
  addProdCode: item.add_prod_code || '',
  reverseSale: item.reverse_sale || '',
  unitPrice: item.unit_price || '',
  unitMeasure: item.unit_measure || '',
  saleChannel: item.sale_channel || '',
  rebateLabel: item.rebate_label || '',
  addProdInfo: item.add_prod_info || '',
  isSelected: item.is_selected || false,
  createdAt: item.created_at || ''
});

// Générer des SaleItem par défaut
const generateDefaultSaleItems = (count = 35) => Array.from({ length: count }, (_, i) => ({
  itemId: '',
  buttonLabel: `Item${i + 1}`,
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
  normalizeButtonLabel,
  prepareSaleItemValues,
  transformSaleItem,
  generateDefaultSaleItems,
  generateLengthHeader,
  insertWithErrorHandling
};
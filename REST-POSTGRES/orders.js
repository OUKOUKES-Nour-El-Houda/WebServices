const express = require('express');
const postgres = require('postgres');
const z = require('zod');

const app = express();
const router = express.Router();

// Middleware pour parser les requêtes JSON
app.use(express.json());  // S'assurer que les données JSON sont bien parsées

const sql = postgres({ db: "mydb", user: "user", password: "password", port: 5433 });

// Définition du schéma pour la commande (order)
const OrderSchema = z.object({
  userId: z.number().int().positive(),
  productIds: z.array(z.object({
    productId: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })), 
  total: z.number().optional(),
  payment: z.boolean().default(false),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
});

const CreateOrderSchema = OrderSchema.omit({ total: true, createdAt: true, updatedAt: true });

router.post('/', async (req, res) => {
  console.log('Requête reçue :', req.body); // Log pour vérifier la requête reçue
  
  // Validation de la requête via Zod
  const result = CreateOrderSchema.safeParse(req.body);

  // Si la validation échoue
  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  // Extraction des données validées
  const { userId, productIds, payment = false } = result.data;

  try {
    // Vérifier si l'utilisateur existe dans la base de données
    const user = await sql`SELECT id FROM users WHERE id = ${userId}`;
    if (user.length === 0) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérification de l'existence des produits dans la base de données
    const products = await sql`
      SELECT id, price FROM products 
      WHERE id IN (${sql(productIds.map(item => item.productId))})
    `;

    if (products.length === 0) {
      return res.status(404).json({ message: "Aucun produit trouvé" });
    }

    // Calcul du total
    let total = 0;
    productIds.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        total += product.price * item.quantity * 1.2; // Total avec la TVA de 20%
      }
    });

    // Insérer la nouvelle commande dans la base de données
    const newOrder = await sql`
      INSERT INTO orders (
        "userId", 
        "productIds", 
        total, 
        payment
      )
      VALUES (
        ${userId}, 
        ${JSON.stringify(productIds)}, 
        ${total}, 
        ${payment}
      )
      RETURNING *
    `;

    // Réponse avec les informations de la commande
    res.status(201).json({
      ...newOrder[0],
      user: user[0],
      products: products
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la création de la commande", error: error.message });
  }
});
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { userId, productIds, payment } = req.body;
  
    try {
      // Vérifier si la commande existe
      const existingOrder = await sql`SELECT * FROM orders WHERE id = ${id}`;
      
      if (existingOrder.length === 0) {
        return res.status(404).json({ message: "Commande non trouvée" });
      }
  
      // Vérifier si l'utilisateur existe si userId est fourni
      if (userId) {
        const user = await sql`SELECT id FROM users WHERE id = ${userId}`;
        if (user.length === 0) {
          return res.status(404).json({ message: "Utilisateur non trouvé" });
        }
      }
  
      // Récupérer le produit pour calculer le total si productIds est fourni
      let total = existingOrder[0].total;
      
      if (productIds) {
        const product = await sql`
          SELECT * FROM products 
          WHERE id = ${productIds}
        `;
  
        if (product.length === 0) {
          return res.status(404).json({ message: "Produit non trouvé" });
        }
  
        // Recalculer le total
        total = product[0].price * 1.2;
      }
  
      // Construire l'objet avec les champs à mettre à jour
      let updateFields = { updatedAt: new Date() };
      
      if (userId) updateFields.userId = userId;
      if (productIds) {
        updateFields.productIds = productIds;
        updateFields.total = total;
      }
      if (payment !== undefined) updateFields.payment = payment;
  
      // Mettre à jour la commande
      const updatedOrder = await sql`
        UPDATE orders
        SET ${sql(updateFields)}
        WHERE id = ${id}
        RETURNING *
      `;
  
      // Récupérer les détails de l'utilisateur et du produit pour la réponse
      const user = await sql`SELECT id, username, email FROM users WHERE id = ${updatedOrder[0].userId}`;
      
      const product = await sql`
        SELECT * FROM products 
        WHERE id = ${updatedOrder[0].productIds}
      `;
  
      res.json({
        ...updatedOrder[0],
        user: user[0],
        product: product[0]
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erreur lors de la mise à jour de la commande", error: error.message });
    }
  });
  
  // Supprimer une commande
  router.delete('/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
      const result = await sql`
        DELETE FROM orders WHERE id = ${id}
        RETURNING id
      `;
  
      if (result.length === 0) {
        return res.status(404).json({ message: "Commande non trouvée" });
      }
  
      res.json({ message: "Commande supprimée avec succès", id });
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la suppression de la commande", error: error.message });
    }
  });
  
  // Mettre à jour le statut de paiement d'une commande
  router.patch('/:id/payment', async (req, res) => {
    const { id } = req.params;
    const { payment } = req.body;
  
    if (payment === undefined) {
      return res.status(400).json({ message: "Le statut de paiement est requis" });
    }
  
    try {
      const updatedOrder = await sql`
        UPDATE orders
        SET payment = ${payment}, "updatedAt" = ${new Date()}
        WHERE id = ${id}
        RETURNING *
      `;
  
      if (updatedOrder.length === 0) {
        return res.status(404).json({ message: "Commande non trouvée" });
      }
  
      // Récupérer les détails de l'utilisateur et du produit pour la réponse
      const user = await sql`SELECT id, username, email FROM users WHERE id = ${updatedOrder[0].userId}`;
      
      const product = await sql`
        SELECT * FROM products 
        WHERE id = ${updatedOrder[0].productIds}
      `;
  
      res.json({
        ...updatedOrder[0],
        user: user[0],
        product: product[0]
      });
    } catch (error) {
      res.status(500).json({ message: "Erreur lors de la mise à jour du statut de paiement", error: error.message });
    }
  });
  
  module.exports = router;
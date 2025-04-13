const express = require('express');
const postgres = require('postgres');
const z = require('zod');

const app = express();
const router = express.Router();

app.use(express.json());  


const sql = postgres({ db: "mydb", user: "user", password: "password", port: 5433 });

const ReviewSchema = z.object({
  userId: z.number().int().positive(),
  productId: z.number().int().positive(),
  score: z.number().int().min(1).max(5),
  content: z.string().min(3, "Le contenu de l'avis doit contenir au moins 3 caractères"),
  createdAt: z.date().optional(), 
  updatedAt: z.date().optional()  
});

const CreateReviewSchema = ReviewSchema.omit({ createdAt: true, updatedAt: true });

// Récupérer tous les avis
router.get('/', async (req, res) => {
  const { page = 1, limit = 10, userId, productId } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = sql`SELECT * FROM reviews WHERE TRUE`;
    
    if (userId) {
      query = sql`${query} AND "userId" = ${userId}`;
    }
    
    if (productId) {
      query = sql`${query} AND "productId" = ${productId}`;
    }
    
    query = sql`${query} ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const reviews = await query;

    // Pour chaque avis, récupérer l'utilisateur et le produit
    const reviewsWithDetails = await Promise.all(reviews.map(async (review) => {
      const user = await sql`SELECT id, username, email FROM users WHERE id = ${review.userId}`;
      const product = await sql`SELECT id, name FROM products WHERE id = ${review.productId}`;
      
      return {
        ...review,
        user: user[0] || null,
        product: product[0] || null
      };
    }));

    res.json(reviewsWithDetails);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la récupération des avis", error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const review = await sql`
      SELECT * FROM reviews WHERE id = ${id}
    `;

    if (review.length === 0) {
      return res.status(404).json({ message: "Avis non trouvé" });
    }

    // Récupérer les détails de l'utilisateur et du produit
    const user = await sql`SELECT id, username, email FROM users WHERE id = ${review[0].userId}`;
    const product = await sql`SELECT id, name FROM products WHERE id = ${review[0].productId}`;

    res.json({
      ...review[0],
      user: user[0] || null,
      product: product[0] || null
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération de l'avis", error: error.message });
  }
});

// Créer un nouvel avis
router.post('/', async (req, res) => {
  const result = CreateReviewSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { userId, productId, score, content } = result.data;

  try {
    // Vérifier si l'utilisateur existe
    const user = await sql`SELECT id FROM users WHERE id = ${userId}`;
    if (user.length === 0) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Vérifier si le produit existe
    const product = await sql`SELECT id FROM products WHERE id = ${productId}`;
    if (product.length === 0) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    // Vérifier si l'utilisateur a déjà laissé un avis pour ce produit
    const existingReview = await sql`
      SELECT id FROM reviews 
      WHERE "userId" = ${userId} AND "productId" = ${productId}
    `;

    if (existingReview.length > 0) {
      return res.status(400).json({ 
        message: "Vous avez déjà laissé un avis pour ce produit", 
        reviewId: existingReview[0].id 
      });
    }

    // Créer l'avis
    const newReview = await sql`
      INSERT INTO reviews (
        "userId", 
        "productId", 
        score, 
        content, 
        "createdAt", 
        "updatedAt"
      )
      VALUES (
        ${userId}, 
        ${productId}, 
        ${score}, 
        ${content}, 
        NOW(), 
        NOW()
      )
      RETURNING *
    `;

    // Mettre à jour le produit avec l'ID de la review et recalculer le score total
    // 1. Récupérer toutes les reviews pour ce produit
    const productReviews = await sql`
      SELECT score FROM reviews WHERE "productId" = ${productId}
    `;
    
    // 2. Calculer le score moyen
    const totalScore = productReviews.reduce((sum, review) => sum + review.score, 0);
    const averageScore = totalScore / productReviews.length;
    
    // 3. Récupérer les IDs des reviews pour ce produit
    const reviewIds = (await sql`
      SELECT id FROM reviews WHERE "productId" = ${productId}
    `).map(r => r.id);
    
    // 4. Mettre à jour le produit
    await sql`
      UPDATE products 
      SET 
        "reviewIds" = ${reviewIds}, 
        "averageScore" = ${averageScore}, 
        "updatedAt" = NOW()
      WHERE id = ${productId}
    `;

    res.status(201).json({
      ...newReview[0],
      user: user[0],
      product: product[0],
      message: "Avis créé avec succès"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la création de l'avis", error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const result = CreateReviewSchema.partial().safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({ errors: result.error.errors });
  }

  const { score, content } = result.data;

  try {
    const existingReview = await sql`SELECT * FROM reviews WHERE id = ${id}`;
    
    if (existingReview.length === 0) {
      return res.status(404).json({ message: "Avis non trouvé" });
    }

    let updateFields = { updatedAt: new Date() };
    
    if (score !== undefined) updateFields.score = score;
    if (content !== undefined) updateFields.content = content;

    const updatedReview = await sql`
      UPDATE reviews
      SET ${sql(updateFields)}
      WHERE id = ${id}
      RETURNING *
    `;

    if (score !== undefined) {
      const productId = updatedReview[0].productId;
      
      const productReviews = await sql`
        SELECT score FROM reviews WHERE "productId" = ${productId}
      `;
      
      const totalScore = productReviews.reduce((sum, review) => sum + review.score, 0);
      const averageScore = totalScore / productReviews.length;
      
      await sql`
        UPDATE products 
        SET "averageScore" = ${averageScore}, "updatedAt" = NOW()
        WHERE id = ${productId}
      `;
    }

    const user = await sql`SELECT id, username, email FROM users WHERE id = ${updatedReview[0].userId}`;
    const product = await sql`SELECT id, name FROM products WHERE id = ${updatedReview[0].productId}`;

    res.json({
      ...updatedReview[0],
      user: user[0] || null,
      product: product[0] || null,
      message: "Avis mis à jour avec succès"
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la mise à jour de l'avis", error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const review = await sql`SELECT * FROM reviews WHERE id = ${id}`;
    
    if (review.length === 0) {
      return res.status(404).json({ message: "Avis non trouvé" });
    }
    
    const productId = review[0].productId;

    await sql`DELETE FROM reviews WHERE id = ${id}`;


    const productReviews = await sql`
      SELECT score FROM reviews WHERE "productId" = ${productId}
    `;
    
    let averageScore = 0;
    if (productReviews.length > 0) {
      const totalScore = productReviews.reduce((sum, review) => sum + review.score, 0);
      averageScore = totalScore / productReviews.length;
    }
    
    const reviewIds = (await sql`
      SELECT id FROM reviews WHERE "productId" = ${productId}
    `).map(r => r.id);
    
    await sql`
      UPDATE products 
      SET 
        "reviewIds" = ${reviewIds}, 
        "averageScore" = ${averageScore}, 
        "updatedAt" = NOW()
      WHERE id = ${productId}
    `;

    res.json({ message: "Avis supprimé avec succès", id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors de la suppression de l'avis", error: error.message });
  }
});

module.exports = router;
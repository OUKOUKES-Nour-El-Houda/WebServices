const express = require("express");
const { swaggerUi, swaggerSpec } = require('./swagger');

const postgres = require ("postgres");
const z = require("zod");
const f2pGamesRouter = require('./f2pGames'); 
const ordersRouter = require('./orders');
const reviewsRouter = require('./reviews');


const crypto = require('crypto');

const app = express();
const port = 8000;

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/f2p-games', f2pGamesRouter);
app.use('/orders', ordersRouter);
app.use('/reviews', reviewsRouter);

const sql = postgres({ db: "mydb", user: "user", password: "password", port: 5433 });

app.use(express.json());

const ProductSchema = z.object({
  id: z.string(),
  name: z.string().min(3, "Le nom du produit doit contenir au moins 3 caractères"), 
  about: z.string().min(10, "La description du produit doit contenir au moins 10 caractères"), 
  price: z.number().positive("Le prix doit être un nombre positif"),
});

const CreateProductSchema = ProductSchema.omit({ id: true });

app.get("/", (req, res) => {
  res.send("Hello World!");
});
/**
 * @swagger
 * /products/{id}:
 *   get:
 *     summary: Récupérer un produit par ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *     responses:
 *       200:
 *         description: Produit trouvé
 *       404:
 *         description: Produit non trouvé
 */
app.get("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const product = await sql`
      SELECT * FROM products WHERE id = ${id}
    `;

    if (product.length === 0) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    const reviews = await sql`
      SELECT r.*, u.username, u.email 
      FROM reviews r
      JOIN users u ON r."userId" = u.id
      WHERE r."productId" = ${id}
      ORDER BY r."createdAt" DESC
    `;
    const formattedReviews = reviews.map(review => ({
      id: review.id,
      score: review.score,
      content: review.content,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      user: {
        id: review.userId,
        username: review.username,
        email: review.email
      }
    }));

    const productWithReviews = {
      ...product[0],
      reviews: formattedReviews
    };

    
    res.json(product[0]);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération du produit", error: error.message });
  }
});
/**
 * @swagger
 * /products:
 *   get:
 *     summary: Récupérer la liste des produits
 *     responses:
 *       200:
 *         description: Liste des produits
 */
app.get("/products", async (req, res) => {
  const { page = 1, limit = 10, name, about, price } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = "SELECT * FROM products WHERE TRUE"; 
    const queryParams = [];
    let paramIndex = 1; 

    if (name) {
      query += ` AND name ILIKE $${paramIndex}`;
      queryParams.push(`%${name}%`);
      paramIndex++;
    }

    if (about) {
      query += ` AND about ILIKE $${paramIndex}`;
      queryParams.push(`%${about}%`);
      paramIndex++;
    }

    if (price) {
      const priceValue = parseFloat(price);
      if (isNaN(priceValue)) {
        return res.status(400).json({ message: "Le prix doit être un nombre valide" });
      }
      query += ` AND price <= $${paramIndex}`;
      queryParams.push(priceValue);
      paramIndex++;
    }

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const products = await sql.unsafe(query, queryParams);

    res.json(products);
  } catch (error) {
    console.error(error); 
    res.status(500).json({ message: "Erreur lors de la récupération des produits", error: error.message });
  }
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Créer un nouveau produit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             properties:
 *               name:
 *                 type: string
 *               about:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       201:
 *         description: Produit créé avec succès
 */
app.post("/products", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);
  
    if (result.success) {
      const { name, about, price } = result.data;
  
      try {
        const product = await sql`
          INSERT INTO products (name, about, price)
          VALUES (${name}, ${about}, ${price})
          RETURNING *
        `;
        
  
        res.status(201).send(product[0]);
      } catch (error) {
        console.error("Error during insertion:", error);  
        res.status(500).json({ message: "Erreur lors de l'insertion du produit", error: error.message });
      }
    } else {
      res.status(400).send(result.error.errors);
    }
  });
  
/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Supprime un produit
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: L'ID du produit à supprimer
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Produit supprimé avec succès
 *       404:
 *         description: Produit non trouvé
 */
app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await sql`
      DELETE FROM products WHERE id = ${id}
    `;

    if (result.count === 0) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }

    res.json({ message: "Produit supprimé avec succès" });
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la suppression du produit", error: error.message });
  }
});

function hashPassword(password) {
  return crypto.createHash('sha512').update(password).digest('hex');
}
/**
 * @swagger
 * /users:
 *   post:
 *     summary: Crée un utilisateur
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Utilisateur créé
 *       400:
 *         description: Champs requis manquants
 */
app.post('/users', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }
  const hashedPassword = hashPassword(password);
  try {
    const result = await sql`
      INSERT INTO users (username, email, password)
      VALUES (${username}, ${email}, ${hashedPassword})
      RETURNING id, username, email
    `;
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Récupère des utilisateurs
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Numéro de page (par défaut 1)
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         description: Nombre d'utilisateurs par page (par défaut 10)
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Liste des utilisateurs
 */
app.get("/users", async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const users = await sql`
      SELECT id, username, email FROM users LIMIT ${limit} OFFSET ${offset}
    `;

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la récupération des utilisateurs", error: error.message });
  }
});
/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Met à jour un utilisateur
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: L'ID de l'utilisateur à mettre à jour
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Utilisateur mis à jour
 *       404:
 *         description: Utilisateur non trouvé
 */
app.put('/users/:id', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis' });
  }

  const hashedPassword = hashPassword(password);

  try {
    const result = await sql`
      UPDATE users
      SET username = ${username}, email = ${email}, password = ${hashedPassword}
      WHERE id = ${req.params.id}
      RETURNING id, username, email
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/users/:id', async (req, res) => {
  const { username, email, password } = req.body;
  const fields = [];
  const values = [];
  let index = 1;

  if (username) {
    fields.push(`username = $${index}`);
    values.push(username);
    index++;
  }
  if (email) {
    fields.push(`email = $${index}`);
    values.push(email);
    index++;
  }
  if (password) {
    const hashedPassword = hashPassword(password);
    fields.push(`password = $${index}`);
    values.push(hashedPassword);
    index++;
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: "Aucune donnée à mettre à jour" });
  }

  values.push(req.params.id);

  try {
    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${values.length}
      RETURNING id, username, email
    `;

    const result = await sql.unsafe(query, values);

    if (result.length === 0) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    res.json(result[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});

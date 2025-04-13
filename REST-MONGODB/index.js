const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { z } = require("zod");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// === ZOD SCHEMAS ===
const ProductSchema = z.object({
  _id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
  categoryIds: z.array(z.string())
});
const CreateProductSchema = ProductSchema.omit({ _id: true });

const CategorySchema = z.object({
  _id: z.string(),
  name: z.string(),
});
const CreateCategorySchema = CategorySchema.omit({ _id: true });

// === ROUTES ===

// Créer un produit
app.post("/products", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);

  if (result.success) {
    const { name, about, price, categoryIds } = result.data;
    const categoryObjectIds = categoryIds.map(id => new ObjectId(id));

    try {
      const ack = await db.collection("products").insertOne({
        name,
        about,
        price,
        categoryIds: categoryObjectIds,
      });

      res.send({
        _id: ack.insertedId,
        name,
        about,
        price,
        categoryIds: categoryObjectIds,
      });
    } catch (err) {
      res.status(500).send({ error: "Erreur lors de l'ajout du produit." });
    }
  } else {
    res.status(400).send(result);
  }
});

// Créer une catégorie
app.post("/categories", async (req, res) => {
  const result = await CreateCategorySchema.safeParse(req.body);

  if (result.success) {
    const { name } = result.data;

    try {
      const ack = await db.collection("categories").insertOne({ name });
      res.send({ _id: ack.insertedId, name });
    } catch (err) {
      res.status(500).send({ error: "Erreur lors de l'ajout de la catégorie." });
    }
  } else {
    res.status(400).send(result);
  }
});

// Obtenir tous les produits avec leurs catégories (aggregation)
app.get("/products", async (req, res) => {
  try {
    const result = await db.collection("products").aggregate([
      { $match: {} },
      {
        $lookup: {
          from: "categories",
          localField: "categoryIds",
          foreignField: "_id",
          as: "categories",
        },
      },
    ]).toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send({ error: "Erreur lors de la récupération des produits." });
  }
});

// === START SERVER + MONGODB ===
client.connect().then(() => {
  db = client.db("myDB");
  app.listen(port, () => {
    console.log(`Serveur en ligne : http://localhost:${port}`);
  });
});

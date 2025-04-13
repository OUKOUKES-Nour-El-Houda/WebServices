const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();

/**
 * @swagger
 * /games:
 *   get:
 *     summary: Récupère la liste de tous les jeux Free-to-Play
 *     responses:
 *       200:
 *         description: Liste des jeux récupérés avec succès
 *       500:
 *         description: Erreur lors de la récupération des jeux
 */
router.get('/games', async (req, res) => {
  try {
    const response = await fetch('https://www.freetogame.com/api/games');
    const games = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Erreur lors de la récupération des jeux' });
    }

    res.json(games);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /games/{id}:
 *   get:
 *     summary: Récupère un jeu spécifique Free-to-Play par son ID
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: L'ID du jeu à récupérer
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Jeu récupéré avec succès
 *       404:
 *         description: Jeu non trouvé
 *       500:
 *         description: Erreur lors de la récupération du jeu
 */
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const response = await fetch(`https://www.freetogame.com/api/game?id=${id}`);
    const game = await response.json();

    if (!response.ok || !game) {
      return res.status(response.status).json({ error: 'Jeu non trouvé' });
    }

    res.json(game);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

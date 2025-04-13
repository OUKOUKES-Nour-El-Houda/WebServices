const express = require('express');
const mongoose = require('mongoose');
const app = express();
const PORT = 3000;

app.use(express.json());

mongoose.connect('mongodb://localhost:27017/analytics')
  .then(() => {
    console.log('Connecté à MongoDB');
  })
  .catch(err => {
    console.error('Erreur de connexion MongoDB :', err);
  });


const commonFields = {
  source: { type: String, required: true },
  url: { type: String, required: true },
  visitor: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  meta: { type: Object }
};

const View = mongoose.model('View', new mongoose.Schema({ ...commonFields }));
const Action = mongoose.model('Action', new mongoose.Schema({ ...commonFields, action: { type: String, required: true } }));
const Goal = mongoose.model('Goal', new mongoose.Schema({ ...commonFields, goal: { type: String, required: true } }));


app.post('/views', async (req, res) => {
  try {
    const view = new View(req.body);
    await view.save();
    res.status(201).json(view);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/views', async (req, res) => {
  try {
    const filters = req.query;
    const views = await View.find(filters);
    res.json(views);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/views/:id', async (req, res) => {
  try {
    const updated = await View.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/views/:id', async (req, res) => {
  try {
    await View.findByIdAndDelete(req.params.id);
    res.json({ message: 'Vue supprimée.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});


app.post('/actions', async (req, res) => {
  try {
    const action = new Action(req.body);
    await action.save();
    res.status(201).json(action);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/actions', async (req, res) => {
  try {
    const filters = req.query;
    const actions = await Action.find(filters);
    res.json(actions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/actions/:id', async (req, res) => {
  try {
    const updated = await Action.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/actions/:id', async (req, res) => {
  try {
    await Action.findByIdAndDelete(req.params.id);
    res.json({ message: 'Action supprimée.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/goals', async (req, res) => {
  try {
    const goal = new Goal(req.body);
    await goal.save();
    res.status(201).json(goal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/goals', async (req, res) => {
  try {
    const filters = req.query;
    const goals = await Goal.find(filters);
    res.json(goals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/goals/:id', async (req, res) => {
  try {
    const updated = await Goal.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/goals/:id', async (req, res) => {
  try {
    await Goal.findByIdAndDelete(req.params.id);
    res.json({ message: 'Objectif supprimé.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/goals/:goalId/details', async (req, res) => {
    try {
      const goal = await Goal.findById(req.params.goalId);
      if (!goal) return res.status(404).json({ error: 'Goal non trouvé' });
  
      const visitor = goal.visitor;
  
      // Agrégation : récupérer les views et actions liées à ce visitor
      const [views, actions] = await Promise.all([
        View.find({ visitor }),
        Action.find({ visitor })
      ]);
  
      res.json({
        goal,
        views,
        actions
      });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  

app.listen(PORT, () => {
  console.log(`Serveur en route sur http://localhost:${PORT}`);
});

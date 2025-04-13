const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0', 
    info: {
      title: 'jeux market', 
      version: '1.0.0', 
      description: 'API pour gérer les commandes et les utilisateurs', 
    },
  },
  apis: ['./server.js','./f2pGames.js', './orders.js'], // Indiquer où Swagger peut trouver les annotations
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = { swaggerUi, swaggerSpec };





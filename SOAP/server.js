const soap = require("soap");
const fs = require("node:fs");
const http = require("http");
const postgres = require("postgres");

const sql = postgres({ db: "mydb", user: "user", password: "password", port: 5433 });

const service = {
  ProductsService: {
    ProductsPort: {
      CreateProduct: async function ({ name, about, price }, callback) {
        console.log("ARGS : ", { name, about, price });

        if (!name || !about || !price) {
          throw {
            Fault: {
              Code: { Value: "soap:Sender", Subcode: { value: "rpc:BadArguments" } },
              Reason: { Text: "Processing Error" },
              statusCode: 400,
            },
          };
        }

        try {
          const product = await sql`
            INSERT INTO products (name, about, price)
            VALUES (${name}, ${about}, ${price})
            RETURNING *`;

          callback({ id: product[0].id, name, about, price });
        } catch (error) {
          console.error("CreateProduct Error:", error);
          throw {
            Fault: { Code: { Value: "soap:Server" }, Reason: { Text: "Database Error" }, statusCode: 500 },
          };
        }
      },

      // Récupération des produits
      GetProducts: async function (args, callback) {
        try {
          const products = await sql`SELECT * FROM products`;
          callback({ products });
        } catch (error) {
          console.error("GetProducts Error:", error);
          throw {
            Fault: { Code: { Value: "soap:Server" }, Reason: { Text: "Database Error" }, statusCode: 500 },
          };
        }
      },

      PatchProduct: async function ({ id, name, about, price }, callback) {
        if (!id || (!name && !about && !price)) {
          throw {
            Fault: {
              Code: { Value: "soap:Sender", Subcode: { value: "rpc:BadArguments" } },
              Reason: { Text: "Missing Arguments" },
              statusCode: 400,
            },
          };
        }

        try {
          console.log("Updating Product:", { id, name, about, price });

          const product = await sql`
            UPDATE products 
            SET 
              name = COALESCE(${name}, name),
              about = COALESCE(${about}, about),
              price = COALESCE(${price}, price)
            WHERE id = ${id}
            RETURNING *`;

          if (product.length === 0) {
            throw {
              Fault: { Code: { Value: "soap:Server" }, Reason: { Text: "Product Not Found" }, statusCode: 404 },
            };
          }

          callback({ updatedProduct: product[0] });
        } catch (error) {
          console.error("PatchProduct Error:", error);
          throw {
            Fault: { Code: { Value: "soap:Server" }, Reason: { Text: "Database Error" }, statusCode: 500 },
          };
        }
      },

      // Suppression d'un produit
      DeleteProduct: async function ({ id }, callback) {
        if (!id) {
          throw {
            Fault: {
              Code: { Value: "soap:Sender", Subcode: { value: "rpc:BadArguments" } },
              Reason: { Text: "Missing ID" },
              statusCode: 400,
            },
          };
        }

        try {
          const product = await sql`DELETE FROM products WHERE id = ${id} RETURNING *`;

          console.log("Deleted Product:", product);

          if (product.length > 0) {
            callback({ deletedProduct: product[0] });
          } else {
            throw {
              Fault: { Code: { Value: "soap:Server" }, Reason: { Text: "Product Not Found" }, statusCode: 404 },
            };
          }
        } catch (error) {
          console.error("DeleteProduct Error:", error);
          throw {
            Fault: { Code: { Value: "soap:Server" }, Reason: { Text: "Database Error" }, statusCode: 500 },
          };
        }
      },
    },
  },
};

// Création du serveur HTTP
const server = http.createServer(function (request, response) {
  response.end("404: Not Found: " + request.url);
});

server.listen(8000);

const xml = fs.readFileSync("productsService.wsdl", "utf8");
soap.listen(server, "/products", service, xml, function () {
  console.log("SOAP server running at http://localhost:8000/products?wsdl");
});

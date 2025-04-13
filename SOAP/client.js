const soap = require("soap");

soap.createClient("http://localhost:8000/products?wsdl", {}, function (err, client) {
  if (err) {
    console.error("Error creating SOAP client:", err);
    return;
  }
  
  // Appel de CreateProduct (requête valide)
  client.CreateProduct({
    name: "Valid Product",
    about: "This is a valid product",
    price: 25.99
  }, function (err, result) {
    if (err) {
      console.error("Error making SOAP request (CreateProduct):", err.response.status, err.response.statusText, err.body);
      return;
    }
    console.log("Result (CreateProduct):", result);
  });

  
  const updatedProduct = {
    id: "myid", 
    name: "Updated Product Name", 
  };

  client.PatchProduct(updatedProduct, function (err, result) {
    if (err) {
      console.error("Error making SOAP request (PatchProduct):", err.response.status, err.response.statusText, err.body);
      return;
    }
    console.log("Product updated:", result);
  });


  const productIdToDelete = "myid"; 
  client.DeleteProduct({ id: productIdToDelete }, function (err, result) {
    if (err) {
      console.error("Error making SOAP request (DeleteProduct):", err.response.status, err.response.statusText, err.body);
      return;
    }
    console.log("Product deleted:", result);
  });
});

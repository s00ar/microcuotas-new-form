module.exports = {
    // ... other configurations
  
    resolve: {
      fallback: {
        "path": require.resolve("path-browserify")
      }
    }
  };
  
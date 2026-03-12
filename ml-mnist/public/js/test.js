function evaluate(model, testData) {
  let correct = 0;
  for (let i = 0; i < testData.labels.length; i++) {
    const pred = model.predict(testData.pixels[i]);
    if (pred === testData.labels[i]) correct++;
  }
  return correct / testData.labels.length;
}

const FILES = {
  tiny: { train: '/mnist/mnist_train_100.csv', test: '/mnist/mnist_test_10.csv', hasHeader: false },
  medium: { train: '/mnist/mnist_train.csv', test: '/mnist/mnist_test.csv', hasHeader: true, trainLimit: 10000, testLimit: 1000 },
  full: { train: '/mnist/mnist_train.csv', test: '/mnist/mnist_test.csv', hasHeader: true }
};

const SAMPLES_INFO = {
  tiny: 'Tiny: 100 образцов для обучения, 10 для теста — быстрая проверка',
  medium: 'Medium: 10000 для обучения, 1000 для теста',
  full: 'Full: 60000 для обучения, 10000 для теста'
};

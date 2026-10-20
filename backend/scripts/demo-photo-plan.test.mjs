import test from 'node:test';
import assert from 'node:assert/strict';
import { demoPhotoKey, demoPhotoDescription, distinctDemoPhotoKey, correctedDemoPhotoKeys, demoPhotoGalleryDescription, expandedJoggerPhotoKeys } from './demo-photo-plan.mjs';

test('explicit model and generation matching rejects unrelated cars', () => {
  assert.equal(demoPhotoKey({ brand: 'Audi', model: 'Q5', year: 2022 }), 'q5');
  assert.equal(demoPhotoKey({ brand: 'Renault', model: 'Clio', year: 2000 }), 'clio2');
  assert.equal(demoPhotoKey({ brand: 'Renault', model: 'Clio', year: 2024 }), 'clio5');
  assert.equal(demoPhotoKey({ brand: 'Renault', model: 'Clio', year: 2010 }), null);
  assert.equal(demoPhotoKey({ brand: 'BMW', model: 'Série 3', year: 2022 }), null);
});

test('distinct replacement matches only the reviewed vehicle identity and model', () => {
  const row = { id: 'cmpfgsa2b00f4rm90ok1pl518', brand: 'Audi', model: 'Q5', year: 2023 };
  assert.equal(distinctDemoPhotoKey(row), 'q5_alt');
  assert.equal(distinctDemoPhotoKey({ ...row, model: 'Q3' }), null);
  assert.equal(distinctDemoPhotoKey({ ...row, id: 'another-car' }), null);
});

test('public description identifies illustrative content and carries source/licence', () => {
  const source = { illustrativeOnly: true, author: 'Example', license: 'CC BY-SA 4.0', sourcePage: 'https://commons.wikimedia.org/wiki/File:Example.jpg', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0' };
  const text = demoPhotoDescription('[DADOS FICTÍCIOS DE TESTE] Descrição.', source);
  assert.match(text, /não este exemplar/);
  assert.ok(text.includes(source.sourcePage));
  assert.ok(text.includes(source.licenseUrl));
  assert.throws(() => demoPhotoDescription('Real stock', source));
  const gallery = demoPhotoGalleryDescription('[DADOS FICTÍCIOS DE TESTE] Descrição.', [source, { ...source, author: 'Other photographer' }]);
  assert.match(gallery, /Fotografia ilustrativa 2: Other photographer/);
  assert.equal(gallery.split('não este exemplar').length, 2);
});

test('old Jogger gallery gets three independently credited photos only for the reviewed identity', () => {
  const row = { id: 'cmpfgs5mq00dyrm90fxofh72o', brand: 'Dacia', model: 'Jogger' };
  assert.deepEqual(correctedDemoPhotoKeys(row), ['dacia', 'dacia_rear', 'dacia_side']);
  assert.equal(correctedDemoPhotoKeys({ ...row, model: 'Duster' }), null);
});

test('expanded Jogger gallery has exactly twelve distinct reviewed source keys', () => {
  const row = { id: 'cmpfgs5mq00dyrm90fxofh72o', brand: 'Dacia', model: 'Jogger' };
  const keys = expandedJoggerPhotoKeys(row);
  assert.equal(keys.length, 12);
  assert.equal(new Set(keys).size, 12);
  assert.deepEqual(keys.slice(0, 3), ['dacia', 'dacia_rear', 'dacia_side']);
  assert.equal(expandedJoggerPhotoKeys({ ...row, id: 'another-car' }), null);
});

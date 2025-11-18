const request = require('supertest');
const app = require('../server');

describe('Auth Endpoints', () => {
  it('should fail login with invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fake@email.com', password: 'wrongpass' });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  // Puedes agregar más pruebas aquí, por ejemplo:
  // it('should login with valid credentials', async () => {...})
});

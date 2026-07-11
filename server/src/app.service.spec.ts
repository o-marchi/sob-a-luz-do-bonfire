import { AppService } from './app.service';

describe('AppService', () => {
  it('returns the health message', () => {
    const service = new AppService();

    expect(service.getHello()).toBe('Hello World!');
  });
});

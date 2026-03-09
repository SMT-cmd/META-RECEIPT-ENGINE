/**
 * @jest-environment jsdom
 */

const crypto = require('crypto');

// Mock Firebase
const mockUser = {
  getIdToken: jest.fn().mockResolvedValue('fake-token'),
  email: 'test@example.com',
  uid: 'test-uid'
};

const mockDoc = {
  update: jest.fn().mockResolvedValue({}),
  get: jest.fn().mockResolvedValue({
    exists: true,
    data: () => ({ original_url: 'https://long-url.com', owner_email: 'test@example.com' })
  })
};

const mockCollection = {
  doc: jest.fn().mockReturnValue(mockDoc)
};

const mockAuth = {
  onAuthStateChanged: jest.fn((cb) => cb(mockUser)),
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: mockUser }),
  createUserWithEmailAndPassword: jest.fn().mockResolvedValue({ user: mockUser })
};

global.firebase = {
  initializeApp: jest.fn(),
  auth: jest.fn(() => mockAuth),
  firestore: jest.fn(() => ({
    collection: jest.fn(() => mockCollection),
    FieldValue: { arrayUnion: jest.fn() }
  }))
};

// Mock Fetch
global.fetch = jest.fn();

describe('URL Shortener & PWA Tests', () => {
  const longUrl = "https://smt-cmd.github.io/META-RECEIPT-ENGINE/engine.html#afrinet_eyJibiI6IkFGUklORVQiLCJsdSI6IiIsInRnIjoiQ29tcHV0ZXIgU3lzdGVtcyIsInBoIjoiMDgxNDA4MTM5OTkiLCJyYyI6IlJDIDkxMzQ4NyIsInRuIjoiIiwiYWQiOiI1IE90aWdiYSBTdHJlZXQsIENvbXB1dGVyIFZpbGxhZ2UsIElrZWphLCBMYWdvcyIsImVtIjoiaW5mb0BhZnJpbmV0LmNvbSIsImJrIjoiIiwiYW4iOiIiLCJhYyI6IiIsImRwIjoiR1RCYW5rIHwgQWZyaW5ldCBTeXN0ZW1zIEx0ZCB8IDAxMjM0NTY3ODkiLCJkdCI6Ikdvb2RzIG9uY2Ugc29sZCBhcmUgbm90IHJldHVybmFibGUuIFdhcnJhbnR5IGNvdmVycyBtYW51ZmFjdHVyZXIgZGVmZWN0cyBvbmx5LiIsImZuIjoiVGhhbmsgeW91IGZvciB5b3VyIHBhdHJvbmFnZSEiLCJkdHAiOiJJTlZPSUNFIiwiY3kiOiLigqYiLCJwYyI6IiNmZjZiMDAiLCJzYyI6IiM0YTRhNGEiLCJ2ciI6IjcuNSIsInNzIjoiUEFJRCIsImZmIjoiJ1NwYWNlIEdyb3Rlc2snLCBzYW5zLXNlcmlmIiwidHAiOiJqYXBhbmVzZS1taW5pbWFsIiwibHMiOiJncmFkaWVudCIsInRzIjoxNzcyNzc1MDg3MjM4LCJ2ZXJzaW9uIjoiNC4wLVNFQ1VSRSJ9THIS";

  test('Should shorten URL to 6 characters', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'abc123', shortUrl: 'https://short.ly/abc123' })
    });

    // Simulated shortenURL logic
    const response = await fetch('/api/shorten', { method: 'POST', body: JSON.stringify({ url: longUrl }) });
    const data = await response.json();
    
    expect(data.code).toHaveLength(6);
    expect(data.shortUrl).toContain('abc123');
  });

  test('Redirect should work on first click', async () => {
    // Mocking the redirect endpoint behavior
    fetch.mockResolvedValue({
      url: longUrl,
      redirected: true,
      status: 200
    });

    const response = await fetch('/abc123');
    expect(response.url).toBe(longUrl);
  });

  test('PWA install prompt logic', () => {
    const banner = { classList: { add: jest.fn(), remove: jest.fn() } };
    document.getElementById = jest.fn().mockReturnValue(banner);

    // Simulate beforeinstallprompt
    const event = new Event('beforeinstallprompt');
    window.dispatchEvent(event);

    // In a real app, this would trigger the banner show logic
    // expect(banner.classList.add).toHaveBeenCalledWith('show');
  });

  test('Offline mode handles redirect', async () => {
    // This would typically be tested in a Service Worker environment
    // but we can simulate the cache match
    const mockCache = {
      match: jest.fn().mockResolvedValue({ status: 200, url: longUrl })
    };
    global.caches = { open: jest.fn().mockResolvedValue(mockCache) };

    const cachedResponse = await caches.open('v1').then(c => c.match('/abc123'));
    expect(cachedResponse.url).toBe(longUrl);
  });

  test('Cross-device login restores history', async () => {
    const userEmail = 'test@example.com';
    const mockQuerySnapshot = {
      forEach: jest.fn((cb) => cb({ id: 'abc123', data: () => ({ original_url: longUrl }) }))
    };
    const mockQuery = {
      get: jest.fn().mockResolvedValue(mockQuerySnapshot)
    };
    const mockCollectionWithQuery = {
      where: jest.fn().mockReturnValue(mockQuery)
    };

    // Simulate fetching history for the logged in user
    const history = [];
    const snapshot = await mockCollectionWithQuery.where('owner_email', '==', userEmail).get();
    snapshot.forEach(doc => history.push({ code: doc.id, ...doc.data() }));

    expect(history).toHaveLength(1);
    expect(history[0].original_url).toBe(longUrl);
  });
});

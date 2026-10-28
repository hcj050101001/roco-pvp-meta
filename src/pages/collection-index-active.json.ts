import type { APIRoute } from 'astro';
import { collectionIndex } from '../lib/collection-index';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(collectionIndex('active')), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });

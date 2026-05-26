import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken, JwtPayload } from '../services/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Требуется авторизация' });
  }

  const token = header.slice(7);
  try {
    request.user = verifyAccessToken(token);
  } catch {
    return reply.code(401).send({ error: 'Токен недействителен или истёк' });
  }
}

export async function requireMaster(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (!request.user?.is_master) {
    return reply.code(403).send({ error: 'Только для мастеров' });
  }
}

import {createHash} from 'node:crypto';
export const classicPrefix=()=>`geek:classic:${process.env.VERCEL_ENV==='production'?'production':createHash('sha256').update(`${process.env.VERCEL_ENV||'development'}:${process.env.VERCEL_URL||'local'}`).digest('hex').slice(0,16)}`;
export const pushOutboxKey=()=>`${classicPrefix()}:push:outbox`;

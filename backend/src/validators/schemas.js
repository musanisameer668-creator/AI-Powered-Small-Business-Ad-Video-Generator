import { z } from 'zod';

const req = (label, max) => z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(max, `${label} is too long.`);
const opt = (max) => z.string().trim().max(max, 'Text is too long.').optional().default('');

export const registerSchema = z.object({
  name: req('Name', 60),
  email: z.string({ error: 'Email is required.' }).trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
  password: z.string({ error: 'Password is required.' }).min(6, 'Password must be at least 6 characters.').max(100),
});
export const loginSchema = z.object({
  email: z.string({ error: 'Email is required.' }).trim().toLowerCase().pipe(z.email('Enter a valid email address.')),
  password: z.string({ error: 'Password is required.' }).min(1, 'Password is required.'),
});

export const GOALS = ['Product Promotion', 'Festival Offer', 'New Shop Launch', 'Brand Awareness', 'Discount Sale'];
export const TONES = ['Friendly and energetic', 'Professional', 'Festive', 'Premium', 'Funny'];
export const PLATFORMS = ['Instagram', 'WhatsApp Status', 'Facebook', 'YouTube Shorts'];
export const FORMATS = ['Portrait Reel', 'Square Post', 'Landscape Video'];
export const LANGUAGES = ['Hinglish', 'Hindi', 'English'];

export const inputSchema = z.object({
  businessName: req('Business name', 80),
  productName: req('Product or service', 80),
  description: opt(500),
  usp: opt(300),
  offer: opt(120),
  city: opt(60),
  goal: z.enum(GOALS).optional().default(GOALS[0]),
  audience: opt(200),
  tone: z.enum(TONES).optional().default(TONES[0]),
  platform: z.enum(PLATFORMS).optional().default(PLATFORMS[0]),
  format: z.enum(FORMATS).optional().default(FORMATS[0]),
  language: z.enum(LANGUAGES).optional().default(LANGUAGES[0]),
});

export const createProjectSchema = z.object({
  input: inputSchema,
  generate: z.boolean().optional().default(true),
});

export const contentSchema = z.object({
  headline: req('Headline', 120),
  caption: req('Caption', 1200),
  cta: opt(120),
  hashtags: z.array(z.string().trim().max(40)).max(20).optional(),
  narration: z.string().trim().max(1200).optional(),
  scenes: z.array(z.object({ caption: z.string().trim().max(160) }).passthrough()).max(6).optional(),
});
export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required.').max(100).optional(),
  content: contentSchema.optional(),
});
export const keySchema = z.object({ key: z.string().trim().max(200) });


import { Language, Scenario } from './types';

export const LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English (US)', flag: '🇺🇸', nativeName: 'English' },
  { code: 'en-GB', name: 'English (UK)', flag: '🇬🇧', nativeName: 'English' },
];

export const SCENARIOS: Scenario[] = [
  {
    id: 'general',
    title: 'Свободное общение',
    description: 'Говорите о чем угодно для практики речи.',
    icon: 'fa-comments',
    prompt: 'You are a friendly English language partner for a Russian speaker. Engage in a casual conversation.'
  },
  {
    id: 'interview',
    title: 'Собеседование',
    description: 'Подготовьтесь к вопросам на английском языке.',
    icon: 'fa-briefcase',
    prompt: 'You are an HR manager at an international company. The user is a candidate from Russia applying for a software engineer position.'
  },
  {
    id: 'travel',
    title: 'Путешествие: Аэропорт',
    description: 'Практикуйте прохождение регистрации и контроля.',
    icon: 'fa-plane',
    prompt: 'You are an airport staff member. The user is a traveler who needs help with check-in or finding their gate.'
  },
  {
    id: 'grammar',
    title: 'Разбор грамматики',
    description: 'ИИ поможет вам понять сложные правила.',
    icon: 'fa-book-open',
    prompt: 'You are an English grammar tutor. Focus on helping the user practice specific constructions. If they make a mistake typical for Russian speakers (like missing articles), explain the rule briefly.'
  }
];

export const GEMINI_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

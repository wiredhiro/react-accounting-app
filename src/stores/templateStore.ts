import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { JournalTemplate } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface TemplateStore {
  templates: JournalTemplate[];
  addTemplate: (template: Omit<JournalTemplate, 'id' | 'createdAt'>) => void;
  updateTemplate: (id: string, template: Partial<Omit<JournalTemplate, 'id' | 'createdAt'>>) => void;
  deleteTemplate: (id: string) => void;
  setTemplates: (templates: JournalTemplate[]) => void;
}

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set) => ({
      templates: [],

      addTemplate: (templateData) => {
        const newTemplate: JournalTemplate = {
          ...templateData,
          id: uuidv4(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          templates: [...state.templates, newTemplate],
        }));
      },

      updateTemplate: (id, templateData) => {
        set((state) => ({
          templates: state.templates.map((template) =>
            template.id === id
              ? { ...template, ...templateData }
              : template
          ),
        }));
      },

      deleteTemplate: (id) => {
        set((state) => ({
          templates: state.templates.filter((template) => template.id !== id),
        }));
      },

      setTemplates: (templates) => {
        set({ templates });
      },
    }),
    {
      name: 'template-storage',
    }
  )
);

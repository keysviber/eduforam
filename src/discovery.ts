export const grades = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Form 1",
  "Form 2",
  "Form 3",
  "Form 4",
  "Form 5",
  "Form 6",
];

export function matchesHomeGrade(level: string, grade: string | null) {
  if (!grade) return false;
  const learner = grades.indexOf(grade);
  const content = grades.indexOf(level);
  return learner >= 0 && content >= 0 && Math.abs(learner - content) <= 1;
}

export const languageCategories = [
  "Greetings",
  "Polite words",
  "Numbers",
  "Everyday phrases",
];
export const curriculum = [
  {
    name: "French",
    code: "fr-FR",
    units: [
      [
        ["Bonjour", "Hello"],
        ["Bonsoir", "Good evening"],
        ["Au revoir", "Goodbye"],
      ],
      [
        ["Merci", "Thank you"],
        ["S’il vous plaît", "Please"],
        ["Pardon", "Sorry"],
      ],
      [
        ["Un", "One"],
        ["Deux", "Two"],
        ["Trois", "Three"],
      ],
      [
        ["Je m’appelle…", "My name is…"],
        ["Comment ça va ?", "How are you?"],
        ["Je vais bien", "I am well"],
      ],
    ],
  },
  {
    name: "Dutch",
    code: "nl-NL",
    units: [
      [
        ["Hallo", "Hello"],
        ["Goedemorgen", "Good morning"],
        ["Tot ziens", "Goodbye"],
      ],
      [
        ["Dank je", "Thank you"],
        ["Alstublieft", "Please"],
        ["Sorry", "Sorry"],
      ],
      [
        ["Een", "One"],
        ["Twee", "Two"],
        ["Drie", "Three"],
      ],
      [
        ["Ik heet…", "My name is…"],
        ["Hoe gaat het?", "How are you?"],
        ["Het gaat goed", "I am well"],
      ],
    ],
  },
  {
    name: "Spanish",
    code: "es-ES",
    units: [
      [
        ["Hola", "Hello"],
        ["Buenos días", "Good morning"],
        ["Adiós", "Goodbye"],
      ],
      [
        ["Gracias", "Thank you"],
        ["Por favor", "Please"],
        ["Lo siento", "Sorry"],
      ],
      [
        ["Uno", "One"],
        ["Dos", "Two"],
        ["Tres", "Three"],
      ],
      [
        ["Me llamo…", "My name is…"],
        ["¿Cómo estás?", "How are you?"],
        ["Estoy bien", "I am well"],
      ],
    ],
  },
];

// Additional practical vocabulary, using the same progress and pronunciation flow.
languageCategories.push("At school", "Food and water");
const extraUnits: Record<string, string[][][]> = {
  French: [
    [
      ["Un livre", "A book"],
      ["Un stylo", "A pen"],
      ["Une ?cole", "A school"],
    ],
    [
      ["De l?eau", "Water"],
      ["Du pain", "Bread"],
      ["Une pomme", "An apple"],
    ],
  ],
  Dutch: [
    [
      ["Een boek", "A book"],
      ["Een pen", "A pen"],
      ["Een school", "A school"],
    ],
    [
      ["Water", "Water"],
      ["Brood", "Bread"],
      ["Een appel", "An apple"],
    ],
  ],
  Spanish: [
    [
      ["Un libro", "A book"],
      ["Un bol?grafo", "A pen"],
      ["Una escuela", "A school"],
    ],
    [
      ["Agua", "Water"],
      ["Pan", "Bread"],
      ["Una manzana", "An apple"],
    ],
  ],
};
for (const course of curriculum) course.units.push(...extraUnits[course.name]);

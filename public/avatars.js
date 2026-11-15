export const AVATARS = [
  { id: 'red-shades', name: 'Red Shades', caption: 'Cool under cross-examination.', src: '/avatars/red-shades.webp' },
  { id: 'drama-shirt', name: 'Full Drama', caption: 'Every reaction is a statement.', src: '/avatars/drama-shirt.webp' },
  { id: 'order-judge', name: 'Order! Order!', caption: 'The court has heard enough.', src: '/avatars/order-judge.webp' },
  { id: 'side-eye-aunty', name: 'Side-Eye Aunty', caption: 'She already knows the whole story.', src: '/avatars/side-eye-aunty.webp' },
  { id: 'chai-witness', name: 'Chai Witness', caption: 'Came for chai. Stayed for the drama.', src: '/avatars/chai-witness.webp' },
  { id: 'objection-lawyer', name: 'Objection!', caption: 'One more point, your honour.', src: '/avatars/objection-lawyer.webp' }
];

export const THEMES = [
  { id: 'white', name: 'Parchment White (Original)', desc: 'Warm ivory judicial paper and classic court styling.' },
  { id: 'clean-white', name: 'Clean Editorial White', desc: 'Minimalist bright modern courthouse.' },
  { id: 'dark-noir', name: 'Dark Courtroom Noir', desc: 'Deep velvet mahogany and golden brass accents.' }
];

export const avatarById = id => AVATARS.find(avatar => avatar.id === id);

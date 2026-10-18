// "a lawn pro", "an HVAC pro", "an appliance repair pro"
export function aCategoryPro(name: string) {
  const word = name === name.toUpperCase() ? name : name.toLowerCase();
  const article = /^(hvac|[aeiou])/i.test(word) ? "an" : "a";
  return `${article} ${word} pro`;
}

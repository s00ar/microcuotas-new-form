export const splitFullName = (fullName = "") => {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { nombre: "", apellido: "" };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { nombre: parts[0], apellido: "" };
  }
  return {
    nombre: parts.slice(0, -1).join(" "),
    apellido: parts.slice(-1).join(" "),
  };
};

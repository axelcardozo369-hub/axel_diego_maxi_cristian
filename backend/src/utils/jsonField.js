import { DataTypes } from 'sequelize';

// Campo JSON portable: se guarda como TEXT y se convierte al leer/escribir.
// Funciona igual en MySQL y en MariaDB (donde JSON es un alias de LONGTEXT
// y mysql2 lo devolvería como string).
export const jsonField = (nombre, opciones = {}) => ({
  type: DataTypes.TEXT('long'),
  ...opciones,
  get() {
    const crudo = this.getDataValue(nombre);
    if (crudo == null) return null;
    try { return JSON.parse(crudo); } catch { return crudo; }
  },
  set(valor) {
    this.setDataValue(nombre, valor == null ? null : JSON.stringify(valor));
  },
});

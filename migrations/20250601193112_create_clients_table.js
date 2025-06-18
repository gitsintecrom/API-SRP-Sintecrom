exports.up = function (knex) {
  return knex.schema.createTable("clients", function (table) {
    table.increments("id").primary();
    table.string("name").notNullable();
    table.string("phone").notNullable();
    table.string("address");
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());
  });
};

exports.down = function (knex) {
  return knex.schema.dropTable("clients");
};

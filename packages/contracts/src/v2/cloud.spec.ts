import { describe, expect, it } from "vitest";

import {
	classifySql,
	cloudBucketNameSchema,
	cloudLogsQuerySchema,
	cloudObjectPathSchema,
	cloudObjectsQuerySchema,
	cloudRoutes,
	cloudRowsQuerySchema,
	cloudSqlBodySchema,
} from "./cloud";

describe("classifySql", () => {
	it("marks a plain select as read", () => {
		expect(classifySql("SELECT id, name FROM users WHERE id = 1")).toBe("read");
	});

	it("marks a select with a CASE ... END as read", () => {
		expect(
			classifySql(
				"select case when active then 'yes' else 'no' end as label from users",
			),
		).toBe("read");
	});

	it("marks explain, show, table, values, and with as reads", () => {
		expect(classifySql("explain analyze select 1")).toBe("read");
		expect(classifySql("show search_path")).toBe("read");
		expect(classifySql("table users")).toBe("read");
		expect(classifySql("values (1), (2)")).toBe("read");
		expect(classifySql("with u as (select 1) select * from u")).toBe("read");
	});

	it("ignores write words inside comments, strings, and quoted names", () => {
		expect(classifySql("-- delete me later\nselect 1")).toBe("read");
		expect(classifySql("/* drop table */ select 1")).toBe("read");
		expect(classifySql("select 'insert into x' as note")).toBe("read");
		expect(classifySql("select 'it''s an update' as note")).toBe("read");
		expect(classifySql('select "delete" from "update"')).toBe("read");
		expect(classifySql("select $$truncate$$ as text")).toBe("read");
	});

	it("marks update, insert, delete, and DDL as writes", () => {
		expect(classifySql("UPDATE users SET name = 'x'")).toBe("write");
		expect(classifySql("insert into users (id) values (1)")).toBe("write");
		expect(classifySql("delete from users")).toBe("write");
		expect(classifySql("create table t (id int)")).toBe("write");
		expect(classifySql("drop table t")).toBe("write");
		expect(classifySql("do $$ begin null; end $$")).toBe("write");
	});

	it("marks a data-modifying CTE and a select into as writes", () => {
		expect(
			classifySql(
				"with moved as (delete from a returning *) insert into b select * from moved",
			),
		).toBe("write");
		expect(classifySql("select * into new_table from users")).toBe("write");
	});

	it("reads the SQL after a name that holds a dollar sign", () => {
		expect(
			classifySql(
				"select x$a$y from t; delete from notes; select z$a$w from t",
			),
		).toBe("write");
	});

	it("reads the SQL after an escape string", () => {
		expect(classifySql("select E'it\\'s'; delete from t; select ''")).toBe(
			"write",
		);
	});

	it("marks sequence writes hidden in a select as writes", () => {
		expect(classifySql("select setval('users_id_seq', 1)")).toBe("write");
		expect(classifySql("select nextval('users_id_seq')")).toBe("write");
	});

	it("marks an empty or comment-only text as write", () => {
		expect(classifySql("")).toBe("write");
		expect(classifySql("-- nothing here")).toBe("write");
	});
});

describe("cloudSqlBodySchema", () => {
	it("defaults confirmWrite to false and trims the query", () => {
		const parsed = cloudSqlBodySchema.parse({ query: "  select 1  " });
		expect(parsed).toEqual({ confirmWrite: false, query: "select 1" });
	});

	it("rejects an empty query", () => {
		expect(cloudSqlBodySchema.safeParse({ query: "   " }).success).toBe(false);
	});
});

describe("cloudRowsQuerySchema", () => {
	it("coerces the page numbers, caps pageSize at 100, and defaults dir", () => {
		expect(cloudRowsQuerySchema.parse({ page: "2", pageSize: "50" })).toEqual({
			dir: "asc",
			page: 2,
			pageSize: 50,
		});
		expect(cloudRowsQuerySchema.safeParse({ pageSize: "101" }).success).toBe(
			false,
		);
	});
});

describe("cloudBucketNameSchema", () => {
	it("accepts letters, digits, dot, dash, underscore and rejects a slash", () => {
		expect(cloudBucketNameSchema.safeParse("my-bucket.v2_x").success).toBe(
			true,
		);
		expect(cloudBucketNameSchema.safeParse("a/b").success).toBe(false);
		expect(cloudBucketNameSchema.safeParse("../up").success).toBe(false);
	});
});

describe("cloudObjectPathSchema", () => {
	it("accepts a nested path and rejects traversal and empty segments", () => {
		expect(cloudObjectPathSchema.safeParse("avatars/user-1.png").success).toBe(
			true,
		);
		expect(cloudObjectPathSchema.safeParse("../secret").success).toBe(false);
		expect(cloudObjectPathSchema.safeParse("/root.png").success).toBe(false);
		expect(cloudObjectPathSchema.safeParse("a//b.png").success).toBe(false);
	});
});

describe("cloudObjectsQuerySchema", () => {
	it("takes a digits-only cursor and defaults the prefix", () => {
		expect(cloudObjectsQuerySchema.parse({ cursor: "100" })).toEqual({
			cursor: "100",
			prefix: "",
		});
		expect(cloudObjectsQuerySchema.safeParse({ cursor: "abc" }).success).toBe(
			false,
		);
	});
});

describe("cloudLogsQuerySchema", () => {
	it("needs ISO instants and a known source", () => {
		expect(
			cloudLogsQuerySchema.safeParse({
				end: "2026-09-17T01:00:00.000Z",
				source: "api",
				start: "2026-09-17T00:00:00.000Z",
			}).success,
		).toBe(true);
		expect(
			cloudLogsQuerySchema.safeParse({
				end: "2026-09-17T01:00:00.000Z",
				source: "auth",
				start: "2026-09-17T00:00:00.000Z",
			}).success,
		).toBe(false);
	});
});

describe("cloudRoutes", () => {
	it("encodes the table and bucket names in the path", () => {
		expect(cloudRoutes.rows("p-1", "my table")).toBe(
			"/api/v2/projects/p-1/cloud/tables/my%20table/rows",
		);
		expect(cloudRoutes.uploadUrl("p-1", "avatars")).toBe(
			"/api/v2/projects/p-1/cloud/storage/buckets/avatars/objects/upload-url",
		);
	});
});

/** @format */

const express = require("express");
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const authorController = require("./author.controller");

router.post("/", requireAdmin, authorController.createAuthor);
router.get("/", authorController.getAllAuthors);
router.get("/:id", authorController.findAuthorById);
router.put("/:id", requireAdmin, authorController.updateAuthor);
router.post("/delete", requireAdmin, authorController.deleteAuthor);

module.exports = router;

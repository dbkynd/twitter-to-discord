'use strict';

const mongoose = require('mongoose');

const feeds = new mongoose.Schema({
  screen_name: String,
  twitter_id: String,
  channels: [{
    guild_id: String,
    channel_id: String,
    created_at: { type: Date, default: Date.now },
  }],
  modified_on: { type: Date, default: Date.now },
});

module.exports = mongoose.model('twitter_feeds', feeds);

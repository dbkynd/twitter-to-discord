'use strict';

const mongoose = require('mongoose');

const tweets = new mongoose.Schema({
  tweet_id: String,
  channels: [{
    guild_id: String,
    channel_id: String,
  }],
});

module.exports = mongoose.model('tweets', tweets);

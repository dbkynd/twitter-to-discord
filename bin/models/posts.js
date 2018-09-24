'use strict';

const mongoose = require('mongoose');

const posts = new mongoose.Schema({
  tweet_id: String,
  messages: [{
    channel_id: String,
    message_id: String,
  }],
});

module.exports = mongoose.model('twitter_posts', posts);

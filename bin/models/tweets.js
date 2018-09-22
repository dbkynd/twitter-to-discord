'use strict';

const mongoose = require('mongoose');

const tweets = new mongoose.Schema({
  tweet_id: String,
  messages: [{
    channel_id: String,
    message_id: String,
  }],
});

module.exports = mongoose.model('twitter_tweets', tweets);

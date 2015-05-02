var Economy = require('../economy');
var PSGO = require('../PSGO');
var addCard = PSGO.addCard;
var getCards = PSGO.getCards;
var Cards = PSGO.cards;
var packs = PSGO.packs;
var packsKeys = Object.keys(packs);

var shop = [
    ['Poke', 'Get a card that has a <b>high chance of being a common or uncommon card</b>. Very low chance for a higher rarity card.', 3],
    ['Great', 'Get a card that has a high chance of being a common or uncommon card. <b>Low chance for a higher rarity card.</b>', 5],
    ['Ultra', 'Get a card that has a <b>high chance of being a uncommon or rare card</b>. Medium chance for a higher rarity card.', 12],
    ['Master', 'Get a card that has a high chance of being a <b>rare or epic card</b>. Medium chance for a higher rarity card.', 25],
    ['Smogon', 'Get a card that has a high chance of being a <b>epic or legendary card.</b>', 40],
    ['Infinite', 'Get a card that has a <b>very high chance of being a legendary card.</b>', 100]
];

var shopDisplay = getShopDisplay(shop);

// Storage for user's packs.
var users = {};

var colors = {
    Legendary: '#FF851B',
    Epic: 'purple',
    Rare: '#0074D9',
    Uncommon: 'gray',
    Common: 'black'
};

module.exports = {
    cards: 'card',
    card: function(target, room, user) {
        if (!this.canBroadcast()) return;
        if (!target) return this.sendReply('/card [card id], [user (optional)] - Show a card. Alias: /cards');

        var cardReference, userReference;
        if (target.indexOf(',') >= 0) {
            var parts = target.split(',');
            cardReference = parts[0];
            userReference = parts[1].trim();
        } else {
            cardReference = target;
            userReference = user.name;
        }

        var match, cardInstance;
        getCards(userReference)
            .then(function(cards) {
                if (!cards || cards.length === 0) {
                    this.sendReply('You have no cards.');
                    return room.update();
                }
                cards.forEach(function(card) {
                    if (card.id === cardReference) {
                        match = true;
                        cardInstance = card;
                    }
                });
                if (!match) {
                    this.sendReply('Card not found.');
                    return room.update();
                }
                if (userReference === user.name) {
                    this.sendReplyBox(createCardDisplay(cardInstance));
                } else {
                    this.sendReplyBox(createCardDisplay(cardInstance, userReference));
                }
                room.update();
            }.bind(this), function(err) {
                if (err) throw err;
            });
    },

    packs: 'pack',
    pack: function(target, room, user) {
        if (!this.canBroadcast()) return;
        if (!target) target = user.name;
        target = toId(target);

        if (!users[target] || users[target].length === 0) {
            return this.sendReply((target === user.userid ? 'You have' : target + ' has') + ' no packs.');
        }

        var packs = {};
        users[target].forEach(function(pack) {
            packs[pack] = (packs[pack] || 0) + 1;
        });
        var pKeys = Object.keys(packs);
        this.sendReply('|raw|<u><b>List of packs:</b></u>');
        pKeys.forEach(function(pack, index) {
            this.sendReply(toTitleCase(pKeys[index]) + ': ' + packs[pKeys[index]]);
        }.bind(this));
    },

    open: 'openpack',
    openpacks: 'openpack',
    openpack: function(target, room, user) {
        if (!this.canBroadcast()) return;
        if (!target) {
            this.sendReply('/openpack [pack] - Open a Pokemon Card Pack. Alias: /open, /openpacks');
            return this.sendReply('Availiable Packs: ' + Object.keys(packs).join(', '));
        }
        if (packsKeys.indexOf(target.toLowerCase()) < 0) return this.sendReply('This pack does not exist.');
        if (!users[user.userid] || users[user.userid].length === 0) return this.sendReply('You have no packs.');
        if (users[user.userid].indexOf(target.toLowerCase()) < 0) return this.sendReply('You do not have this pack.');

        var packId = users[user.userid].splice(users[user.userid].indexOf(target.toLowerCase()), 1)[0];
        var pack = packs[packId]();
        var cardIndex = pack.length - 1;
        var card = pack[cardIndex];
        addCard(user.userid, card);

        var display = '<marquee scrollamount="15" loop="2">';
        pack.forEach(function(card, index) {
            if (index !== cardIndex) {
                display += '<img src="' + card.card + '">&nbsp;&nbsp;&nbsp;';
            } else {
                display += '<blink><img src="' + card.card + '"></blink></marquee>';
            }
        });

        var cardName = toTitleCase(card.name);
        var packName = toTitleCase(target.toLowerCase());
        this.sendReplyBox(display);
        setTimeout(function() {
            room.addRaw(user.name + ' got <font color="' + colors[card.rarity] + '">' + card.rarity + '</font>\
            <button name="send" value="/card ' + card.id + ', ' + user.name + '"><b>' + cardName + '</b></button> from a \
            <button name="send" value="/buypack ' + packName + '">' + packName + ' Pack</button>.');
            room.update();
        }.bind(this), 1000 * 18);
    },

    givepacks: 'givepack',
    givepack: function(target, room, user) {
        if (!user.can('givepack')) return false;
        if (!target) return this.sendReply('/givepack [user], [pack] - Give a user a pack. Alias: /givepacks');

        var parts = target.split(',');
        this.splitTarget(parts[0]);
        if (!parts[1]) return this.sendReply('/givepack [user], [pack] - Give a user a pack. Alias: /givepacks');
        var pack = parts[1].toLowerCase().trim();
        var userid = toId(this.targetUsername);

        if (packsKeys.indexOf(pack) < 0) return this.sendReply('This pack does not exist.');
        if (!this.targetUser) return this.sendReply('User ' + this.targetUsername + ' not found.');
        if (!users[userid]) users[userid] = [];

        users[userid].push(pack);
        console.log(JSON.stringify(users));
        this.sendReply(this.targetUsername + ' was given ' + pack + ' pack. This user now has ' + users[userid].length + ' pack(s).');
        Users.get(this.targetUsername).send(
            '|raw|' + user.name + ' has given you ' + pack + ' pack. You have until the server restarts to open your pack. \
            Use <button name="send" value="/openpack ' + pack + '"><b>/openpack ' + pack + '</b></button> to open your pack.');
    },

    takepacks: 'takepack',
    takepack: function(target, room, user) {
        if (!user.can('takepack')) return false;
        if (!target) return this.sendReply('/takepack [user], [pack] - Take a pack from a user. Alias: /takepacks');

        var parts = target.split(',');
        this.splitTarget(parts[0]);
        if (!parts[1]) return this.sendReply('/takepack [user], [pack] - Take a pack from a user. Alias: /takepacks');
        var pack = parts[1].toLowerCase().trim();
        var packIndex = users[userid].indexOf(pack);
        var userid = toId(this.targetUsername);

        if (packsKeys.indexOf(pack) < 0) return this.sendReply('This pack does not exist.');
        if (!this.targetUser) return this.sendReply('User ' + this.targetUsername + ' not found.');
        if (!users[userid]) users[userid] = [];
        if (packIndex < 0) return this.sendReply('This user does not have this pack.');

        users[userid].splice(packIndex, 1);
        console.log(JSON.stringify(users));
        this.sendReply(this.targetUsername + ' losted ' + pack + ' pack. This user now has ' + users[userid].length + ' pack(s).');
        Users.get(this.targetUsername).send('|raw|' + user.name + ' has taken ' + pack + ' pack from you. You now have ' +  users[userid].length + ' pack(s).');
    },

    packshop: function(target, room, user) {
       if (!this.canBroadcast()) return;
       return this.sendReply('|raw|' + shopDisplay);
    },

    buypacks: 'buypack',
    buypack: function(target, room, user) {
        if (!target) return this.sendReply('/buypack - Buys a pack from the shop. Alias: /buypacks');
        var self = this;
        Economy.get(user.name).then(function(money) {
            var cost = findItem.call(self, target, money);
            if (!cost) return room.update();

            Economy.take(user.name, cost).then(function(total) {
                var pack = target.toLowerCase();
                self.sendReply('|raw|You have bought ' + target + ' pack for ' + cost + 
                    Economy.currency(cost) + '. You now have ' + total + 
                    Economy.currency(total) + ' left. Use <button name="send" value="/openpack ' +
                    pack + '"><b>/openpack ' + pack + '</b></button> to open your pack.');
                self.sendReply('You have until the server restarts to open your pack.');
                if (!users[user.userid]) users[user.userid] = [];
                users[user.userid].push(pack);
                room.addRaw(user.name + ' has bought <b>' + target + ' pack </b> from the shop.');
                room.update();
            });
        });
    },

    showcards: 'showcase',
    showcard: 'showcard',
    showcase: function(target, room, user) {
       if (!this.canBroadcast()) return;
       if (!target) target = user.name;
       getCards(target)
            .then(function(cards) {
                if (!cards || cards.length === 0) {
                    this.sendReply((target === user.name ? 'You have' : target + ' has') + ' no cards.');
                    return room.update();
                }
                var display = '';
                var title = '';
                var points = 0;
                cards.forEach(function(card) {
                    points += card.points;
                    title = card.id + ' ' + toTitleCase(card.rarity) + ' ' + toTitleCase(card.name);
                    display += '<button name="send" value="/card ' + card.id + ', ' + target + 
                        '"><img src="' + card.card + '" width="50" title="' + title +'"></button>';
                });
                display += '<br><br>Total Cards: ' + cards.length + '&nbsp;&nbsp;&nbsp;&nbsp;Total Points: ' + points;
                this.sendReplyBox(display);
                room.update();
            }.bind(this), function(err) {
                if (err) throw err;
            }).done();
    },

    cardstats: 'psgostats',
    psgostats: function(target, room, user) {
        if (!user.can('cardstats')) return false;
        if (!this.canBroadcast()) return;

        var numCards = 0;

        var stats = function(rarity) {
            var names = Object.keys(Cards[rarity]);
            var deck = [];
            numCards += names.length;
            names.forEach(function(name) {
                deck.push(Cards[rarity][name]);
            });
            console.log(deck);
            var total = deck.map(function(card) {
                return card.points;
            }).reduce(function(prev, curr) {
                return prev + curr;
            });
            this.sendReply(toTitleCase(rarity) + ': ' + total + ' points / ' + deck.length + ' cards = ' + (total/deck.length) + ' average points');
        };

        stats.call(this, 'common');
        stats.call(this, 'uncommon');
        stats.call(this, 'rare');
        stats.call(this, 'epic');
        stats.call(this, 'legendary');
        this.sendReply('Total Cards: ' + numCards);
    }
};

/**
 * Make a display for a card.
 *
 * @param {Object} card
 * @param {String} reference - user referred to get to set author
 * @return {String}
 */

function createCardDisplay(card, reference) {
    if (!reference) {
        return '<img src="' + card.card + '" title="' + card.id + '" align="left">\
                <br><center><h1><u><b>' + toTitleCase(card.name) + '</b></u></h1>\
                <br><br>\
                <h2><font color="' + colors[card.rarity] + '">' + card.rarity + '</font></h2>\
                <br><br><br>\
                <font color="#AAA"><i>Points:</i></font><br>' + 
                pointColor(card.points) + '</center><br clear="all">';
    } else {
        return '<img src="' + card.card + '" title="' + card.id + '" align="left">\
                <br><center><h1><u><b>' + toTitleCase(card.name) + '</b></u></h1>\
                <br>owned by <button name="send" value="/showcase ' + reference + '">' + reference + '</button>\
                <br><br>\
                <h2><font color="' + colors[card.rarity] + '">' + card.rarity + '</font></h2>\
                <br><br><br>\
                <font color="#AAA"><i>Points:</i></font><br>' + 
                pointColor(card.points) + '</center><br clear="all">';
    }
}

/**
 * Uppercase first letters of a name.
 *
 * @param {String} str
 * @return {String}
 */

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

/**
 * Get color for pokemon card's points.
 *
 * @param {Number} points
 * @return {String}
 */

function pointColor(points) {
    var clrs = ['red', 'blue', '#FF4136', '#001f3f'];
    var rng = Math.floor(Math.random() * clrs.length);
    return '<font size="50" color="' + clrs[rng] + '"><b>' + points + '</b></font>';
}

/**
 * Displays the shop
 *
 * @param {Array} shop
 * @return {String} display
 */

function getShopDisplay(shop) {
    var display = '<table border="1" cellspacing="0" cellpadding="5" width="100%">\
                    <tbody>\
                        <tr>\
                            <th>Command</th>\
                            <th>Description</th>\
                            <th>Cost</th>\
                        </tr>';
    var start = 0;
    while (start < shop.length) {
        display += '<tr>\
                        <td><button name="send" value="/buypack ' + shop[start][0] + '">' + shop[start][0] + '</button>' + '</td>\
                        <td>' + shop[start][1] + '</td>\
                        <td>' + shop[start][2] + '</td>\
                    </tr>';
        start++;
    }
    display += '</tbody></table><center>To buy a pack from the shop, use /buypack <em>pack</em>.</center>';
    return display;
}

/**
 * Find the item in the shop.
 * 
 * @param {String} item
 * @param {Number} money
 * @return {Object}
 */

function findItem(item, money) {
    var len = shop.length;
    var price = 0;
    var amount = 0;
    while(len--) {
        if (item.toLowerCase() !== shop[len][0].toLowerCase()) continue;
        price = shop[len][2];
        if (price > money) {
            amount = price - money;
            this.sendReply('You don\'t have you enough money for this. You need ' + amount + Economy.currency(amount) + ' more to buy ' + item + '.');
            return false;
        }
        return price;
    }
    this.sendReply(item + ' not found in shop.');
}

# backbone-relational-jsonapi

A helper than enables syncing Backbone Collections in a format compliant with JSONapi 1.0. Also detects changes to related models and saves them.

## Installation

    $ npm install backbone-relational-jsonapi

## Documentation

###Node

First, install the package:

    npm install backbone-sync-jsonapi --save-dev

Then require it:

    var _ = require('underscore'),
        Backbone = require('backbone');
    require('backbone-sync-jsonapi')(Backbone, _);
    Backbone.Relational = require('backbone-relational');

###Browser

First include the script after backbone and underscore.

    <script src="underscore.js"></script>
    <script src="backbone.js"></script>
    <script src="backbone-sync-jsonapi.js"></script>
    <script type="text/javascript">
        backboneSyncJsonapi(Backbone, _);
    </script>
    <script src="backbone-relational.js"></script>

Then boot it up.

##Usage

Everything should happen automatically. For example if you have:

    var Wheel = Backbone.Relational.Model.extend({});
    var Car = Backbone.Relational.Model.extend({
        relations: [
            {
                type: Backbone.Relational.HasMany,
                key: 'wheels'
                relatedModel: Wheel
            }
        ]
    });
    var wheels = new Backbone.Relational.Collection([new Wheel, new Wheel, new Wheel, new Wheel]);
    var myCar = new Car({wheels: wheels});
    
    wheels.first().set('material', 'rubber');
    
and then call:

    myCar.save();
    
then the `.save()` will be called on the modified wheel as well.
 
You can also call `wheels.save()` to save all the wheels in accordance with the jsonAPI spec.
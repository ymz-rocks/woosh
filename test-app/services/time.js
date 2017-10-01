function TimeService(context) // services should implement general behaviors, letting components and widgets to display them
{
    var handle, ticks = [];

    this.start = function()
    {
        function pulse()
        {
            ticks.forEach(function(tick)
            {
                tick(new Date());
            });
        }

        handle = setInterval(pulse, 1000); 
        
        pulse(); return this;
    };

    this.tick = function(action)
    {
        if (action instanceof Function) ticks.push(action);
    };

    this.stop = function()
    {
        clearInterval(handle); return this;
    };
}
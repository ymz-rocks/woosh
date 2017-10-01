function ThemeService(context) // a simple theme service
{
    var path, styleElements;

    this.load = function()
    {
        var theme = arguments[arguments.length - 1]; if (this.current == theme) return;

        this.current = theme; if (styleElements) styleElements[styleElements.length - 1].remove();

        context.services.core.statix(Array.prototype.slice.call(arguments), 'styles').then(function(elements)
        {
            styleElements = elements;
        });
    };
}
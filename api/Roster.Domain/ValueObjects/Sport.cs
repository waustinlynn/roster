namespace Roster.Domain.ValueObjects;

public record Sport(
    string Name,
    IReadOnlyList<string> Skills,
    IReadOnlyList<string> Positions)
{
    public static readonly Sport Softball = new(
        Name: "Softball",
        Skills: ["Hitting", "Catching", "Throwing"],
        Positions:
        [
            "Pitcher", "Catcher",
            "1st Base", "2nd Base", "3rd Base", "Shortstop",
            "Left Field", "Left-Centre Field", "Right-Centre Field", "Right Field"
        ]);

    private static readonly IReadOnlyList<Sport> _all = [Softball];

    public static Sport? FindByName(string name) =>
        _all.FirstOrDefault(s => string.Equals(s.Name, name, StringComparison.OrdinalIgnoreCase));
}

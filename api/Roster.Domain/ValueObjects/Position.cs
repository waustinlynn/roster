namespace Roster.Domain.ValueObjects;

public sealed record Position(string Name)
{
    public bool IsBench => string.Equals(Name, "Bench", StringComparison.OrdinalIgnoreCase);

    public static readonly Position Bench = new("Bench");

    public override string ToString() => Name;
}
